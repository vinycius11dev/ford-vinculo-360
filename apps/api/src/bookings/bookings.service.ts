import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BookingStatus,
  NotificationType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { UpdateBookingDto } from "./dto/update-booking.dto";

type BookingPolicy = {
  id: string;
  timezone: string;
  businessDays: string;
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
  simultaneousCapacity: number;
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthenticatedUser) {
    const where: Prisma.BookingWhereInput =
      actor.role === UserRole.CUSTOMER
        ? { userId: actor.userId }
        : actor.role === UserRole.FORD_ADMIN
          ? {}
          : { dealershipId: actor.dealershipId ?? "__none__" };
    return this.prisma.booking.findMany({
      where,
      include: {
        dealership: {
          select: {
            id: true,
            tradeName: true,
            timezone: true,
            businessDays: true,
            openingTime: true,
            closingTime: true,
            slotDurationMinutes: true,
            simultaneousCapacity: true,
          },
        },
        user: { select: { id: true, fullName: true, phone: true } },
        vehicle: true,
      },
      orderBy: { requestedFor: "asc" },
      take: 250,
    });
  }

  async create(input: CreateBookingDto, actor: AuthenticatedUser) {
    const [vehicle, dealership] = await Promise.all([
      this.prisma.vehicle.findUnique({
        where: { vin: input.vin.toUpperCase() },
      }),
      this.prisma.dealership.findUnique({ where: { id: input.dealershipId } }),
    ]);
    if (!vehicle) throw new NotFoundException("Veículo não encontrado.");
    if (!dealership)
      throw new NotFoundException("Concessionária não encontrada.");
    this.assertDealershipAccess(dealership.id, actor);
    const userId =
      actor.role === UserRole.CUSTOMER ? actor.userId : input.userId;
    if (!userId)
      throw new NotFoundException("Informe o cliente do agendamento.");
    if (actor.role === UserRole.CUSTOMER) {
      const owns = await this.prisma.vehicleOwnership.count({
        where: { vehicleId: vehicle.id, userId, status: "ACTIVE" },
      });
      if (!owns)
        throw new ForbiddenException(
          "Este veículo não está vinculado à sua conta.",
        );
    }
    const customer = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.CUSTOMER, active: true },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Cliente ativo não encontrado.");
    const requestedFor = new Date(input.requestedFor);
    await this.assertAvailable(dealership, requestedFor);
    const booking = await this.prisma.booking.create({
      data: {
        vehicleId: vehicle.id,
        userId,
        dealershipId: input.dealershipId,
        requestedFor,
        notes: input.notes,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        performedById: actor.userId,
        action: "BOOKING_CREATE",
        entityType: "Booking",
        entityId: booking.id,
        metadata: { dealershipId: dealership.id, requestedFor },
      },
    });
    return booking;
  }

  async update(id: string, input: UpdateBookingDto, actor: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { dealership: true },
    });
    if (!booking) throw new NotFoundException("Agendamento não encontrado.");
    const allowed =
      actor.role === UserRole.FORD_ADMIN ||
      (actor.role === UserRole.CUSTOMER
        ? booking.userId === actor.userId
        : booking.dealershipId === actor.dealershipId);
    if (!allowed)
      throw new ForbiddenException("Agendamento fora do seu acesso.");
    if (
      actor.role === UserRole.CUSTOMER &&
      input.status &&
      input.status !== BookingStatus.CANCELLED
    )
      throw new BadRequestException(
        "O cliente pode reagendar ou cancelar, mas não confirmar o próprio atendimento.",
      );
    const requestedFor = input.requestedFor
      ? new Date(input.requestedFor)
      : booking.requestedFor;
    const effectiveStatus = input.status ?? booking.status;
    if (
      effectiveStatus !== BookingStatus.CANCELLED &&
      (input.requestedFor ||
        (booking.status === BookingStatus.CANCELLED && input.status))
    )
      await this.assertAvailable(booking.dealership, requestedFor, id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: input.status,
          requestedFor: input.requestedFor ? requestedFor : undefined,
          notes: input.notes,
        },
      });
      // Quem mexeu no agendamento foi a concessionária: o cliente precisa
      // saber pelo app, sem depender de telefonema.
      const notice = this.customerNotice(
        booking.status,
        updated,
        booking.dealership.tradeName,
        !!input.requestedFor,
      );
      if (notice && actor.userId !== booking.userId)
        await tx.notification.create({
          data: {
            userId: booking.userId,
            type: NotificationType.SERVICE,
            title: notice.title,
            message: notice.message,
            link: "/agendamentos",
          },
        });
      await tx.auditLog.create({
        data: {
          performedById: actor.userId,
          action: "BOOKING_UPDATE",
          entityType: "Booking",
          entityId: id,
          metadata: { status: input.status, requestedFor },
        },
      });
      return updated;
    });
  }

  /** Texto para o titular; devolve null quando nada mudou para ele. */
  private customerNotice(
    previousStatus: BookingStatus,
    booking: { status: BookingStatus; requestedFor: Date; notes: string | null },
    dealership: string,
    rescheduled: boolean,
  ) {
    const service = booking.notes ?? "Atendimento Ford";
    const when = booking.requestedFor.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (booking.status !== previousStatus) {
      if (booking.status === BookingStatus.CONFIRMED)
        return {
          title: "Agendamento confirmado",
          message: `${service} confirmado para ${when} na ${dealership}.`,
        };
      if (booking.status === BookingStatus.CANCELLED)
        return {
          title: "Agendamento cancelado",
          message: `${service} de ${when} na ${dealership} foi cancelado.`,
        };
      if (booking.status === BookingStatus.COMPLETED)
        return {
          title: "Atendimento concluído",
          message: `${service} na ${dealership} foi finalizado. Obrigado pela confiança.`,
        };
    }
    if (rescheduled)
      return {
        title: "Agendamento remarcado",
        message: `${service} passou para ${when} na ${dealership}.`,
      };
    return null;
  }

  private assertDealershipAccess(
    dealershipId: string,
    actor: AuthenticatedUser,
  ) {
    if (
      actor.role !== UserRole.CUSTOMER &&
      actor.role !== UserRole.FORD_ADMIN &&
      actor.dealershipId !== dealershipId
    )
      throw new ForbiddenException(
        "Você só pode agendar na própria concessionária.",
      );
  }

  private async assertAvailable(
    dealership: BookingPolicy,
    requestedFor: Date,
    excludeBookingId?: string,
  ) {
    if (requestedFor.getTime() < Date.now() + 15 * 60_000)
      throw new BadRequestException(
        "Escolha um horário com pelo menos 15 minutos de antecedência.",
      );
    const local = this.localDateParts(requestedFor, dealership.timezone);
    const businessDays = dealership.businessDays.split(",").map(Number);
    const weekday = new Date(
      Date.UTC(local.year, local.month - 1, local.day),
    ).getUTCDay();
    if (!businessDays.includes(weekday))
      throw new BadRequestException(
        "A concessionária não atende no dia selecionado.",
      );
    const opening = this.minutes(dealership.openingTime);
    const closing = this.minutes(dealership.closingTime);
    const selected = local.hour * 60 + local.minute;
    if (
      selected < opening ||
      selected + dealership.slotDurationMinutes > closing
    )
      throw new BadRequestException(
        `Escolha um horário entre ${dealership.openingTime} e ${dealership.closingTime}.`,
      );
    const offsetInsideSlot = (selected - opening) % dealership.slotDurationMinutes;
    const slotStart = new Date(
      requestedFor.getTime() - offsetInsideSlot * 60_000,
    );
    const slotEnd = new Date(
      slotStart.getTime() + dealership.slotDurationMinutes * 60_000,
    );
    const occupied = await this.prisma.booking.count({
      where: {
        dealershipId: dealership.id,
        requestedFor: { gte: slotStart, lt: slotEnd },
        status: { not: BookingStatus.CANCELLED },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    });
    if (occupied >= dealership.simultaneousCapacity)
      throw new BadRequestException(
        "Este horário atingiu a capacidade máxima da oficina.",
      );
  }

  private minutes(value: string) {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  }

  private localDateParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    return {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hour: value("hour"),
      minute: value("minute"),
    };
  }
}
