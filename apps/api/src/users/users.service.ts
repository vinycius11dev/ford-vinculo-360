import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MessageChannel, MessageStatus, Prisma, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { AuthenticatedUser } from "../auth/auth.types";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTeamMemberDto } from "./dto/create-team-member.dto";
import { UpdateTeamMemberDto } from "./dto/update-team-member.dto";
import { CreateTeamInvitationDto } from "./dto/create-team-invitation.dto";
import {
  CustomerProfileDto,
  isValidCnpj,
  isValidCpf,
  onlyDigits,
} from "./dto/customer-profile.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly messaging: MessagingService,
  ) {}

  private webUrl() {
    return (
      this.config.get<string>("APP_WEB_URL") ?? "http://localhost:5173"
    );
  }

  /** Área do proprietário: nunca usar o painel administrativo para ativação. */
  private customerAppUrl() {
    return (
      this.config.get<string>("APP_CUSTOMER_APP_URL") ?? "http://localhost:8081"
    ).replace(/\/$/, "");
  }

  private invitationDealership(
    input: CreateTeamInvitationDto,
    actor: AuthenticatedUser,
  ) {
    return actor.role === UserRole.FORD_ADMIN
      ? input.dealershipId
      : actor.dealershipId;
  }

  async listInvitations(actor: AuthenticatedUser) {
    return this.prisma.userInvitation.findMany({
      where:
        actor.role === UserRole.FORD_ADMIN
          ? {}
          : { dealershipId: actor.dealershipId ?? "__none__" },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        dealershipId: true,
        expiresAt: true,
        acceptedAt: true,
        cancelledAt: true,
        createdAt: true,
        dealership: { select: { tradeName: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async createInvitation(
    input: CreateTeamInvitationDto,
    actor: AuthenticatedUser,
  ) {
    if (input.role === UserRole.CUSTOMER)
      throw new BadRequestException("Convites de equipe não criam clientes.");
    if (
      actor.role !== UserRole.FORD_ADMIN &&
      input.role !== UserRole.DEALERSHIP_AGENT
    )
      throw new ForbiddenException(
        "Gerentes podem convidar apenas usuários consultores.",
      );
    const dealershipId = this.invitationDealership(input, actor);
    if (input.role !== UserRole.FORD_ADMIN && !dealershipId)
      throw new BadRequestException("Informe a concessionária do convite.");
    const dealership = dealershipId
      ? await this.prisma.dealership.findUnique({
          where: { id: dealershipId },
          select: { tradeName: true },
        })
      : null;
    if (dealershipId && !dealership)
      throw new NotFoundException("Concessionária não encontrada.");
    const email = input.email.toLowerCase();
    if (await this.prisma.user.count({ where: { email } }))
      throw new ConflictException("Já existe um usuário com este e-mail.");
    if (
      await this.prisma.userInvitation.count({
        where: {
          email,
          acceptedAt: null,
          cancelledAt: null,
          expiresAt: { gt: new Date() },
        },
      })
    )
      throw new ConflictException("Já existe um convite válido para este e-mail.");
    const token = randomBytes(32).toString("hex");
    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.userInvitation.create({
        data: {
          fullName: input.fullName.trim(),
          email,
          phone: input.phone?.trim() || null,
          role: input.role,
          dealershipId:
            input.role === UserRole.FORD_ADMIN ? null : dealershipId,
          createdById: actor.userId,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          dealershipId: true,
          expiresAt: true,
          createdAt: true,
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "TEAM_INVITATION_CREATE",
          entityType: "UserInvitation",
          entityId: created.id,
          metadata: { email, role: input.role, dealershipId },
        },
      });
      return created;
    });
    const delivery = await this.messaging.sendSensitive(
      MessageChannel.EMAIL,
      "TEAM_INVITATION",
      email,
      {
        fullName: invitation.fullName,
        role: invitation.role,
        dealershipName: dealership?.tradeName ?? null,
        link: `${this.webUrl()}/?invite=${token}`,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      { userId: actor.userId },
    );
    if (delivery.status !== MessageStatus.SENT) {
      await this.prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { cancelledAt: new Date() },
      });
      throw new ServiceUnavailableException(
        "O convite não pôde ser enviado. Gere um novo convite após verificar o serviço de e-mail.",
      );
    }
    return {
      ...invitation,
      ...(this.config.get("NODE_ENV") === "development" &&
      this.config.get("EXPOSE_DEVELOPMENT_TOKENS") === "true" &&
      !this.config.get("SMTP_HOST")
        ? { developmentToken: token }
        : {}),
    };
  }

  async cancelInvitation(id: string, actor: AuthenticatedUser) {
    const invitation = await this.prisma.userInvitation.findFirst({
      where: {
        id,
        ...(actor.role === UserRole.FORD_ADMIN
          ? {}
          : { dealershipId: actor.dealershipId ?? "__none__" }),
      },
    });
    if (!invitation)
      throw new NotFoundException("Convite não encontrado.");
    if (invitation.acceptedAt)
      throw new BadRequestException("Este convite já foi aceito.");
    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.userInvitation.update({
        where: { id },
        data: { cancelledAt: invitation.cancelledAt ?? new Date() },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "TEAM_INVITATION_CANCEL",
          entityType: "UserInvitation",
          entityId: id,
        },
      });
      return cancelled;
    });
  }

  /** Campos cadastrais devolvidos na ficha do cliente. */
  private readonly customerProfileSelect = {
    id: true,
    fullName: true,
    email: true,
    phone: true,
    customerType: true,
    fordRelationship: true,
    cpf: true,
    cnpj: true,
    tradeName: true,
    stateRegistration: true,
    stateRegistrationExempt: true,
    companyRegistrationStatus: true,
    legalRepresentativeName: true,
    legalRepresentativeCpf: true,
    legalRepresentativeDocument: true,
    legalRepresentativeRole: true,
    representationBasis: true,
    representationDocumentChecked: true,
    rg: true,
    rgIssuer: true,
    birthDate: true,
    addressZip: true,
    addressStreet: true,
    addressNumber: true,
    addressComplement: true,
    addressDistrict: true,
    addressCity: true,
    addressState: true,
    active: true,
    passwordSetupRequired: true,
    createdAt: true,
  } as const;

  private customerData(input: CustomerProfileDto) {
    const customerType = input.customerType === "COMPANY" ? "COMPANY" : "INDIVIDUAL";
    if (!input.fordRelationship)
      throw new BadRequestException("Informe se o cliente já possui, já teve ou ainda não teve um Ford.");
    const cpf = customerType === "INDIVIDUAL" && input.cpf ? onlyDigits(input.cpf) : null;
    const cnpj = customerType === "COMPANY" && input.cnpj ? onlyDigits(input.cnpj) : null;
    const legalRepresentativeCpf = customerType === "COMPANY" && input.legalRepresentativeCpf
      ? onlyDigits(input.legalRepresentativeCpf)
      : null;
    if (cpf && !isValidCpf(cpf))
      throw new BadRequestException("CPF inválido. Confira os dígitos.");
    if (customerType === "COMPANY" && !cnpj)
      throw new BadRequestException("Informe o CNPJ da pessoa jurídica.");
    if (cnpj && !isValidCnpj(cnpj))
      throw new BadRequestException("CNPJ inválido. Confira os dígitos.");
    if (customerType === "COMPANY") {
      if (!input.legalRepresentativeName?.trim())
        throw new BadRequestException("Informe o nome do representante legal.");
      if (!legalRepresentativeCpf || !isValidCpf(legalRepresentativeCpf))
        throw new BadRequestException("CPF do representante legal inválido.");
      if (!input.legalRepresentativeDocument?.trim())
        throw new BadRequestException("Informe o documento do representante legal.");
      if (!input.legalRepresentativeRole?.trim())
        throw new BadRequestException("Informe o cargo do representante legal.");
      if (!input.representationBasis)
        throw new BadRequestException("Selecione o documento que comprova a representação.");
      if (!input.representationDocumentChecked)
        throw new BadRequestException("Confirme a conferência do contrato social, estatuto ou procuração.");
    }
    return {
      customerType,
      fordRelationship: input.fordRelationship,
      fullName: input.fullName.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone?.trim() || null,
      cpf: cpf || null,
      cnpj: cnpj || null,
      tradeName: customerType === "COMPANY" ? input.tradeName?.trim() || null : null,
      stateRegistration: customerType === "COMPANY" && !input.stateRegistrationExempt
        ? input.stateRegistration?.trim() || null
        : null,
      stateRegistrationExempt: customerType === "COMPANY" && Boolean(input.stateRegistrationExempt),
      companyRegistrationStatus: customerType === "COMPANY"
        ? input.companyRegistrationStatus?.trim() || null
        : null,
      legalRepresentativeName: customerType === "COMPANY"
        ? input.legalRepresentativeName?.trim() || null
        : null,
      legalRepresentativeCpf,
      legalRepresentativeDocument: customerType === "COMPANY"
        ? input.legalRepresentativeDocument?.trim() || null
        : null,
      legalRepresentativeRole: customerType === "COMPANY"
        ? input.legalRepresentativeRole?.trim() || null
        : null,
      representationBasis: customerType === "COMPANY" ? input.representationBasis ?? null : null,
      representationDocumentChecked: customerType === "COMPANY" && Boolean(input.representationDocumentChecked),
      rg: customerType === "INDIVIDUAL" ? input.rg?.trim() || null : null,
      rgIssuer: customerType === "INDIVIDUAL" ? input.rgIssuer?.trim().toUpperCase() || null : null,
      birthDate: customerType === "INDIVIDUAL" && input.birthDate ? new Date(input.birthDate) : null,
      addressZip: input.addressZip ? onlyDigits(input.addressZip) : null,
      addressStreet: input.addressStreet?.trim() || null,
      addressNumber: input.addressNumber?.trim() || null,
      addressComplement: input.addressComplement?.trim() || null,
      addressDistrict: input.addressDistrict?.trim() || null,
      addressCity: input.addressCity?.trim() || null,
      addressState: input.addressState?.trim().toUpperCase() || null,
    };
  }

  /** Lista de clientes com CPF mascarado: a ficha mostra o dado completo. */
  async listCustomers(actor: AuthenticatedUser) {
    const customers = await this.prisma.user.findMany({
      where: { ...this.access(actor), role: UserRole.CUSTOMER },
      select: {
        ...this.customerProfileSelect,
        _count: { select: { ownerships: true, purchases: true } },
      },
      orderBy: { fullName: "asc" },
      take: 250,
    });
    return customers.map(({ cpf, cnpj, legalRepresentativeCpf, ...customer }) => ({
      ...customer,
      cpf: cpf ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : null,
      cnpj: cnpj ? `${cnpj.slice(0, 2)}.***.***/${cnpj.slice(8, 12)}-**` : null,
      hasCpf: Boolean(cpf),
      hasCnpj: Boolean(cnpj),
      legalRepresentativeCpf: legalRepresentativeCpf
        ? `***.${legalRepresentativeCpf.slice(3, 6)}.${legalRepresentativeCpf.slice(6, 9)}-**`
        : null,
    }));
  }

  /** Consulta pontual de CEP para preenchimento assistido no cadastro. */
  async lookupCustomerZip(value: string) {
    const zip = onlyDigits(value);
    if (zip.length !== 8)
      throw new BadRequestException("CEP deve conter 8 dígitos.");
    let response: Response;
    try {
      response = await fetch(`https://viacep.com.br/ws/${zip}/json/`, {
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ServiceUnavailableException("Consulta de CEP indisponível no momento.");
    }
    if (!response.ok)
      throw new ServiceUnavailableException("Não foi possível consultar o CEP.");
    const result = (await response.json()) as {
      erro?: boolean;
      cep?: string;
      logradouro?: string;
      complemento?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (result.erro) throw new NotFoundException("CEP não encontrado.");
    return {
      zip: onlyDigits(result.cep ?? zip),
      street: result.logradouro ?? "",
      complement: result.complemento ?? "",
      district: result.bairro ?? "",
      city: result.localidade ?? "",
      state: result.uf ?? "",
    };
  }

  /** Consulta um único CNPJ em fontes públicas e normaliza os campos do cadastro. */
  async lookupCustomerCnpj(value: string) {
    const cnpj = onlyDigits(value);
    if (!isValidCnpj(cnpj))
      throw new BadRequestException("CNPJ inválido. Confira os dígitos.");

    let brasilApiResponse: Response | null = null;
    try {
      brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      brasilApiResponse = null;
    }

    if (brasilApiResponse?.ok) {
      const result = (await brasilApiResponse.json()) as {
        razao_social?: string;
        nome_fantasia?: string;
        descricao_situacao_cadastral?: string;
        email?: string | null;
        ddd_telefone_1?: string | null;
        cep?: string;
        logradouro?: string;
        numero?: string;
        complemento?: string;
        bairro?: string;
        municipio?: string;
        uf?: string;
      };
      return {
        cnpj,
        legalName: result.razao_social ?? "",
        tradeName: result.nome_fantasia ?? "",
        stateRegistration: "",
        registrationStatus: result.descricao_situacao_cadastral ?? "",
        email: result.email ?? "",
        phone: result.ddd_telefone_1 ?? "",
        address: {
          zip: onlyDigits(result.cep ?? ""),
          street: result.logradouro ?? "",
          number: result.numero ?? "",
          complement: result.complemento ?? "",
          district: result.bairro ?? "",
          city: result.municipio ?? "",
          state: result.uf ?? "",
        },
      };
    }

    let publicResponse: Response;
    try {
      publicResponse = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ServiceUnavailableException("Consulta de CNPJ indisponível no momento.");
    }
    if (publicResponse.status === 404) throw new NotFoundException("CNPJ não encontrado.");
    if (publicResponse.status === 429)
      throw new ServiceUnavailableException("Limite temporário da consulta de CNPJ. Tente novamente em um minuto.");
    if (!publicResponse.ok)
      throw new ServiceUnavailableException("Não foi possível consultar o CNPJ.");

    const result = (await publicResponse.json()) as {
      razao_social?: string;
      estabelecimento?: {
        nome_fantasia?: string;
        situacao_cadastral?: string;
        email?: string | null;
        ddd1?: string | null;
        telefone1?: string | null;
        cep?: string;
        logradouro?: string;
        numero?: string;
        complemento?: string;
        bairro?: string;
        cidade?: { nome?: string };
        estado?: { sigla?: string };
        inscricoes_estaduais?: Array<{ inscricao_estadual?: string; ativo?: boolean }>;
      };
    };
    const establishment = result.estabelecimento ?? {};
    const stateRegistration = establishment.inscricoes_estaduais?.find((item) => item.ativo)?.inscricao_estadual
      ?? establishment.inscricoes_estaduais?.[0]?.inscricao_estadual
      ?? "";
    return {
      cnpj,
      legalName: result.razao_social ?? "",
      tradeName: establishment.nome_fantasia ?? "",
      stateRegistration,
      registrationStatus: establishment.situacao_cadastral ?? "",
      email: establishment.email ?? "",
      phone: `${establishment.ddd1 ?? ""}${establishment.telefone1 ?? ""}`,
      address: {
        zip: onlyDigits(establishment.cep ?? ""),
        street: establishment.logradouro ?? "",
        number: establishment.numero ?? "",
        complement: establishment.complemento ?? "",
        district: establishment.bairro ?? "",
        city: establishment.cidade?.nome ?? "",
        state: establishment.estado?.sigla ?? "",
      },
    };
  }

  async findCustomer(id: string, actor: AuthenticatedUser) {
    const customer = await this.prisma.user.findFirst({
      where: { id, role: UserRole.CUSTOMER, ...this.access(actor) },
      select: {
        ...this.customerProfileSelect,
        loyalty: { select: { balance: true } },
        ownerships: {
          where: { status: "ACTIVE" },
          select: {
            startedAt: true,
            vehicle: {
              select: {
                vin: true,
                plate: true,
                model: true,
                modelYear: true,
                currentMileage: true,
                warrantyUntil: true,
              },
            },
          },
        },
        purchases: {
          select: {
            id: true,
            price: true,
            soldAt: true,
            vehicle: { select: { model: true, modelYear: true } },
          },
          orderBy: { soldAt: "desc" },
        },
      },
    });
    if (!customer) throw new NotFoundException("Cliente não encontrado.");
    return customer;
  }

  async createCustomer(input: CustomerProfileDto, actor: AuthenticatedUser) {
    const data = this.customerData(input);
    if (await this.prisma.user.count({ where: { email: data.email } }))
      throw new ConflictException("Já existe uma conta com este e-mail.");
    if (data.cpf && (await this.prisma.user.count({ where: { cpf: data.cpf } })))
      throw new ConflictException("Já existe um cliente com este CPF.");
    if (data.cnpj && (await this.prisma.user.count({ where: { cnpj: data.cnpj } })))
      throw new ConflictException("Já existe um cliente com este CNPJ.");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const customer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          ...data,
          role: UserRole.CUSTOMER,
          registeredByDealershipId: actor.dealershipId,
          // O cliente define a própria senha no primeiro acesso; a rede nunca
          // conhece a credencial.
          passwordHash: await hash(randomBytes(24).toString("hex"), 12),
          active: false,
          passwordSetupRequired: true,
          loyalty: { create: {} },
        },
        select: this.customerProfileSelect,
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "CUSTOMER_CREATE",
          entityType: "User",
          entityId: created.id,
          metadata: { email: data.email, customerType: data.customerType, fordRelationship: data.fordRelationship, hasDocument: Boolean(data.cpf || data.cnpj) },
        },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: created.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt,
        },
      });
      return created;
    });
    const delivery = await this.messaging.sendSensitive(
      MessageChannel.EMAIL,
      "CUSTOMER_ACTIVATION",
      customer.email,
      {
        fullName: customer.fullName,
        link: `${this.customerAppUrl()}/?reset=${token}`,
        expiresAt: expiresAt.toISOString(),
      },
      { userId: customer.id },
    );
    if (delivery.status !== MessageStatus.SENT) {
      await this.prisma.passwordResetToken.updateMany({
        where: {
          tokenHash: createHash("sha256").update(token).digest("hex"),
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      throw new ServiceUnavailableException(
        "A conta foi criada, mas a mensagem de ativação não pôde ser enviada.",
      );
    }
    return customer;
  }

  async updateCustomer(
    id: string,
    input: CustomerProfileDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, role: UserRole.CUSTOMER, ...this.access(actor) },
    });
    if (!existing) throw new NotFoundException("Cliente não encontrado.");
    const data = this.customerData(input);
    if (
      data.email !== existing.email &&
      (await this.prisma.user.count({ where: { email: data.email } }))
    )
      throw new ConflictException("Já existe uma conta com este e-mail.");
    if (
      data.cpf &&
      data.cpf !== existing.cpf &&
      (await this.prisma.user.count({ where: { cpf: data.cpf } }))
    )
      throw new ConflictException("Já existe um cliente com este CPF.");
    if (
      data.cnpj &&
      data.cnpj !== existing.cnpj &&
      (await this.prisma.user.count({ where: { cnpj: data.cnpj } }))
    )
      throw new ConflictException("Já existe um cliente com este CNPJ.");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data,
        select: this.customerProfileSelect,
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "CUSTOMER_UPDATE",
          entityType: "User",
          entityId: id,
        },
      });
      return updated;
    });
  }

  private access(actor: AuthenticatedUser): Prisma.UserWhereInput {
    return actor.role === UserRole.FORD_ADMIN
      ? {}
      : {
          OR: [
            { dealershipId: actor.dealershipId ?? "__none__" },
            // Cliente cadastrado pela unidade, mesmo antes da primeira compra.
            { registeredByDealershipId: actor.dealershipId ?? "__none__" },
            {
              ownerships: {
                some: {
                  vehicle: {
                    OR: [
                      { originDealershipId: actor.dealershipId ?? "__none__" },
                      {
                        serviceOrders: {
                          some: {
                            dealershipId: actor.dealershipId ?? "__none__",
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        };
  }

  async list(actor: AuthenticatedUser) {
    const users = await this.prisma.user.findMany({
      where: this.access(actor),
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        customerType: true,
        fordRelationship: true,
        companyRegistrationStatus: true,
        legalRepresentativeName: true,
        legalRepresentativeCpf: true,
        legalRepresentativeDocument: true,
        legalRepresentativeRole: true,
        representationBasis: true,
        representationDocumentChecked: true,
        active: true,
        dealershipId: true,
        createdAt: true,
        loyalty: { select: { balance: true } },
        ownerships: {
          where: { status: "ACTIVE" },
          select: {
            vehicle: {
              select: {
                vin: true,
                model: true,
                modelYear: true,
                currentMileage: true,
                updatedAt: true,
                serviceOrders: {
                  where: { status: "COMPLETED" },
                  orderBy: { completedAt: "desc" },
                  take: 1,
                  select: { completedAt: true, mileage: true },
                },
              },
            },
          },
        },
        _count: { select: { ownerships: true, bookings: true } },
      },
      orderBy: { fullName: "asc" },
      take: 250,
    });
    return users.map((user) => {
      const status = user.companyRegistrationStatus
        ?.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      const companyReadyForPurchase = user.customerType !== "COMPANY" || Boolean(
        status === "ATIVA" &&
        user.legalRepresentativeName &&
        user.legalRepresentativeCpf &&
        user.legalRepresentativeDocument &&
        user.legalRepresentativeRole &&
        user.representationBasis &&
        user.representationDocumentChecked,
      );
      const {
        companyRegistrationStatus: _companyRegistrationStatus,
        legalRepresentativeName: _legalRepresentativeName,
        legalRepresentativeCpf: _legalRepresentativeCpf,
        legalRepresentativeDocument: _legalRepresentativeDocument,
        legalRepresentativeRole: _legalRepresentativeRole,
        representationBasis: _representationBasis,
        representationDocumentChecked: _representationDocumentChecked,
        ...safeUser
      } = user;
      return { ...safeUser, companyReadyForPurchase };
    });
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findFirst({
      where: { id, ...this.access(actor) },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        dealership: true,
        loyalty: {
          include: {
            transactions: { orderBy: { createdAt: "desc" }, take: 20 },
            vouchers: true,
          },
        },
        ownerships: {
          include: { vehicle: true },
          orderBy: { startedAt: "desc" },
        },
        bookings: {
          include: { vehicle: true, dealership: true },
          orderBy: { requestedFor: "desc" },
        },
      },
    });
    if (!user) throw new NotFoundException("Usuário não encontrado.");
    return user;
  }

  async createTeamMember(input: CreateTeamMemberDto, actor: AuthenticatedUser) {
    if (input.role === UserRole.CUSTOMER)
      throw new BadRequestException(
        "Use o cadastro de cliente para este perfil.",
      );
    if (
      actor.role !== UserRole.FORD_ADMIN &&
      input.role !== UserRole.DEALERSHIP_AGENT
    )
      throw new ForbiddenException(
        "Gerentes podem criar apenas usuários consultores.",
      );
    const dealershipId =
      actor.role === UserRole.FORD_ADMIN
        ? input.dealershipId
        : actor.dealershipId;
    if (input.role !== UserRole.FORD_ADMIN && !dealershipId)
      throw new BadRequestException("Informe a concessionária do usuário.");
    if (
      dealershipId &&
      !(await this.prisma.dealership.count({ where: { id: dealershipId } }))
    )
      throw new NotFoundException("Concessionária não encontrada.");
    const email = input.email.toLowerCase();
    if (await this.prisma.user.count({ where: { email } }))
      throw new ConflictException("Já existe um usuário com este e-mail.");
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.user.create({
        data: {
          fullName: input.fullName,
          email,
          phone: input.phone,
          role: input.role,
          dealershipId:
            input.role === UserRole.FORD_ADMIN ? null : dealershipId,
          passwordHash: await hash(input.password, 12),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          active: true,
          dealershipId: true,
          createdAt: true,
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "TEAM_MEMBER_CREATE",
          entityType: "User",
          entityId: member.id,
          metadata: { role: member.role, dealershipId: member.dealershipId },
        },
      });
      return member;
    });
  }

  async updateTeamMember(
    id: string,
    input: UpdateTeamMemberDto,
    actor: AuthenticatedUser,
  ) {
    const member = await this.prisma.user.findUnique({ where: { id } });
    if (!member || member.role === UserRole.CUSTOMER)
      throw new NotFoundException("Integrante da equipe não encontrado.");
    if (
      actor.role !== UserRole.FORD_ADMIN &&
      (member.dealershipId !== actor.dealershipId ||
        member.role !== UserRole.DEALERSHIP_AGENT)
    )
      throw new ForbiddenException("Você não pode alterar este usuário.");
    if (
      actor.role !== UserRole.FORD_ADMIN &&
      input.role &&
      input.role !== UserRole.DEALERSHIP_AGENT
    )
      throw new ForbiddenException(
        "Você não pode elevar a permissão deste usuário.",
      );
    if (id === actor.userId && input.active === false)
      throw new BadRequestException(
        "Você não pode desativar o próprio acesso.",
      );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          fullName: input.fullName,
          phone: input.phone,
          role: input.role,
          active: input.active,
          passwordHash: input.password
            ? await hash(input.password, 12)
            : undefined,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          active: true,
          dealershipId: true,
          createdAt: true,
        },
      });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "TEAM_MEMBER_UPDATE",
          entityType: "User",
          entityId: id,
          metadata: { role: updated.role, active: updated.active },
        },
      });
      return updated;
    });
  }
}
