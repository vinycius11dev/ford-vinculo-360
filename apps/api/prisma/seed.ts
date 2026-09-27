import {
  PrismaClient,
  UserRole,
  OwnershipStatus,
  ServiceOrderStatus,
  BookingStatus,
  RepurchaseLeadStatus,
  RecallSeverity,
  RecallTargetStatus,
  ConsentPurpose,
  NotificationType,
  SupportTicketStatus,
  SupportTicketPriority,
  SupportTicketCategory,
  VoucherStatus,
  DataRequestType,
  DataRequestStatus,
  VehicleCondition,
  VehicleSaleStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const now = new Date();

/** Data relativa a hoje, para a demonstração nunca envelhecer. */
function daysAgo(days: number, hour = 10, minute = 0) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function monthsAhead(months: number) {
  const date = new Date(now);
  date.setMonth(date.getMonth() + months);
  return date;
}

/** N-ésimo dia útil a partir de hoje, dentro do expediente da oficina. */
function businessDayAhead(offset: number, hour: number, minute = 0) {
  const date = new Date(now);
  let remaining = offset;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) remaining -= 1;
  }
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  if (date.getDay() === 6) date.setDate(date.getDate() + 2);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Remove resíduos dos testes automatizados (smoke tests) para que a base de
 * demonstração fique apresentável. Nenhum dado de negócio é afetado.
 */
async function removeTestArtifacts() {
  const testEmail = { contains: "smoke." };
  const testUsers = await prisma.user.findMany({
    where: { email: testEmail },
    select: { id: true },
  });
  const testUserIds = testUsers.map((user) => user.id);
  if (testUserIds.length) {
    await prisma.supportTicket.deleteMany({
      where: { requesterId: { in: testUserIds } },
    });
    await prisma.booking.deleteMany({ where: { userId: { in: testUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  }
  await prisma.userInvitation.deleteMany({ where: { email: testEmail } });
  await prisma.outboundMessage.deleteMany({
    where: { recipient: testEmail },
  });
  await prisma.booking.deleteMany({
    where: {
      OR: [
        { notes: { contains: "Teste de capacidade" } },
        { notes: { contains: "Validação automática" } },
      ],
    },
  });
  // Zera as sessões acumuladas: o painel de dispositivos conectados deve
  // começar limpo, com apenas o acesso feito na hora da apresentação.
  await prisma.authSession.deleteMany({});

  // Registros da geração anterior da base de demonstração, substituídos pelo
  // histórico relativo criado abaixo.
  const legacyOrderIds = [
    { startsWith: "seed-os-" },
    { startsWith: "seed-vehicle-" },
  ];
  await prisma.pointTransaction.deleteMany({
    where: {
      OR: [
        ...legacyOrderIds.map((serviceOrderId) => ({ serviceOrderId })),
        { id: "seed-points-carlos-1" },
      ],
    },
  });
  await prisma.serviceOrder.deleteMany({
    where: { OR: legacyOrderIds.map((id) => ({ id })) },
  });
  await prisma.booking.deleteMany({
    where: { id: { in: ["seed-booking-carlos", "seed-booking-fernanda"] } },
  });

  // Notificações geradas antes da tradução dos status de privacidade: o texto
  // trazia o enum interno (IN_REVIEW, RECEIVED…) direto para o cliente.
  await prisma.notification.deleteMany({
    where: {
      OR: ["IN_REVIEW", "RECEIVED", "COMPLETED", "REJECTED"].map((raw) => ({
        message: { contains: `status ${raw}` },
      })),
    },
  });

  // Vendas e agendamentos criados durante demonstrações/testes: só os do seed
  // permanecem, para que a base volte sempre ao mesmo estado.
  await prisma.sale.deleteMany({ where: { NOT: { id: { startsWith: "sale-" } } } });
  await prisma.booking.deleteMany({
    where: { NOT: { id: { startsWith: "seed-booking-" } } },
  });
  // Pontos creditados ao concluir uma OS durante a demonstração: o id é gerado
  // pelo banco, então tudo que não tem o prefixo do seed é resíduo. Sem isto o
  // saldo sobe a cada apresentação e nunca volta ao estado inicial.
  await prisma.pointTransaction.deleteMany({
    where: { NOT: { id: { startsWith: "pts-" } } },
  });
  const demoCustomers = await prisma.user.findMany({
    where: { email: { contains: "@exemplo.com" } },
    select: { id: true },
  });
  if (demoCustomers.length)
    await prisma.user.deleteMany({
      where: { id: { in: demoCustomers.map((user) => user.id) } },
    });
  return testUserIds.length;
}

type StaffSeed = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  dealershipId: string | null;
};

type ServiceSeed = {
  daysAgo: number;
  mileage: number;
  description: string;
  points?: number;
};

type VehicleSeed = {
  key: string;
  /** Código curto usado para gerar IDs determinísticos dentro de VarChar(36). */
  code: string;
  vin: string;
  plate: string;
  model: string;
  modelYear: number;
  manufactureYear: number;
  currentMileage: number;
  dealership: "sp" | "pr" | "mg";
  /** Início real do relacionamento com o atual proprietário. */
  ownershipDaysAgo?: number;
  owner: {
    id: string;
    email: string;
    fullName: string;
    phone: string;
    customerType?: "INDIVIDUAL" | "COMPANY";
    cpf?: string;
    cnpj?: string;
    tradeName?: string;
    stateRegistration?: string;
    companyRegistrationStatus?: string;
    legalRepresentativeName?: string;
    legalRepresentativeCpf?: string;
    legalRepresentativeDocument?: string;
    legalRepresentativeRole?: string;
    representationBasis?: string;
    representationDocumentChecked?: boolean;
    rg?: string;
    rgIssuer?: string;
    birthDate?: string;
    addressZip: string;
    addressStreet: string;
    addressNumber: string;
    addressDistrict: string;
    addressCity: string;
    addressState: string;
  };
  history: ServiceSeed[];
  openOrder?: {
    status: ServiceOrderStatus;
    mileage: number;
    description: string;
  };
};

async function main() {
  const removedUsers = await removeTestArtifacts();
  const passwordHash = await hash("Ford@360", 12);

  const dealerships = {
    sp: await prisma.dealership.upsert({
      where: { cnpj: "12345678000190" },
      update: { tradeName: "Ford Center Norte", simultaneousCapacity: 4 },
      create: {
        id: "seed-dealer-center-norte",
        legalName: "Ford Center Norte Automóveis Ltda.",
        tradeName: "Ford Center Norte",
        cnpj: "12345678000190",
        city: "São Paulo",
        state: "SP",
        simultaneousCapacity: 4,
      },
    }),
    pr: await prisma.dealership.upsert({
      where: { cnpj: "98765432000110" },
      update: { tradeName: "Ford Slaviero", simultaneousCapacity: 3 },
      create: {
        id: "seed-dealer-slaviero",
        legalName: "Slaviero Veículos Ltda.",
        tradeName: "Ford Slaviero",
        cnpj: "98765432000110",
        city: "Curitiba",
        state: "PR",
        simultaneousCapacity: 3,
      },
    }),
    mg: await prisma.dealership.upsert({
      where: { cnpj: "45678912000133" },
      update: { tradeName: "Ford Minas Motors", simultaneousCapacity: 3 },
      create: {
        id: "seed-dealer-minas",
        legalName: "Minas Motors Comércio de Veículos Ltda.",
        tradeName: "Ford Minas Motors",
        cnpj: "45678912000133",
        city: "Belo Horizonte",
        state: "MG",
        simultaneousCapacity: 3,
      },
    }),
  };

  const staff: StaffSeed[] = [
    {
      id: "seed-user-admin",
      email: "admin@ford360.local",
      fullName: "Administrador Ford Brasil",
      phone: "1130030000",
      role: UserRole.FORD_ADMIN,
      dealershipId: null,
    },
    {
      id: "seed-user-manager",
      email: "gerente@ford360.local",
      fullName: "André Martins",
      phone: "11991110001",
      role: UserRole.DEALERSHIP_MANAGER,
      dealershipId: dealerships.sp.id,
    },
    {
      id: "seed-user-agent",
      email: "consultora@ford360.local",
      fullName: "Beatriz Santos",
      phone: "11993334455",
      role: UserRole.DEALERSHIP_AGENT,
      dealershipId: dealerships.sp.id,
    },
    {
      id: "seed-user-agent-sp2",
      email: "consultor.sp@ford360.local",
      fullName: "Thiago Nogueira",
      phone: "11992220002",
      role: UserRole.DEALERSHIP_AGENT,
      dealershipId: dealerships.sp.id,
    },
    {
      id: "seed-user-manager-pr",
      email: "gerente.pr@ford360.local",
      fullName: "Rafael Duarte",
      phone: "41994440004",
      role: UserRole.DEALERSHIP_MANAGER,
      dealershipId: dealerships.pr.id,
    },
    {
      id: "seed-user-agent-pr",
      email: "consultora.pr@ford360.local",
      fullName: "Larissa Prado",
      phone: "41995550005",
      role: UserRole.DEALERSHIP_AGENT,
      dealershipId: dealerships.pr.id,
    },
    {
      id: "seed-user-manager-mg",
      email: "gerente.mg@ford360.local",
      fullName: "Camila Rocha",
      phone: "31996660006",
      role: UserRole.DEALERSHIP_MANAGER,
      dealershipId: dealerships.mg.id,
    },
  ];
  for (const member of staff)
    await prisma.user.upsert({
      where: { email: member.email },
      update: {
        passwordHash,
        fullName: member.fullName,
        phone: member.phone,
        role: member.role,
        dealershipId: member.dealershipId,
        active: true,
      },
      create: {
        id: member.id,
        email: member.email,
        passwordHash,
        fullName: member.fullName,
        phone: member.phone,
        role: member.role,
        dealershipId: member.dealershipId,
      },
    });

  // Carteira distribuída entre as quatro faixas de risco (recência do último
  // serviço na rede): ativo <=240 dias, atenção <=365, em risco <=730, perdido.
  const carlosOwner: VehicleSeed["owner"] = {
    id: "seed-user-carlos",
    customerType: "COMPANY",
    cnpj: "11222333000181",
    tradeName: "Horizonte Logística",
    stateRegistration: "110.042.490.114",
    companyRegistrationStatus: "ATIVA",
    legalRepresentativeName: "Carlos Henrique",
    legalRepresentativeCpf: "52998224725",
    legalRepresentativeDocument: "RG 34.567.890-1",
    legalRepresentativeRole: "Diretor de operações",
    representationBasis: "CONTRATO_SOCIAL",
    representationDocumentChecked: true,
    addressZip: "01310930",
    addressStreet: "Avenida Paulista",
    addressNumber: "1578",
    addressDistrict: "Bela Vista",
    addressCity: "São Paulo",
    addressState: "SP",
    // Mantém o endereço da versão anterior do seed para que a restauração da
    // demonstração atualize o mesmo cadastro, sem deixar um cliente duplicado.
    email: "carlos@ford360.local",
    fullName: "Horizonte Logística Ltda.",
    phone: "11998884421",
  };
  const fleet: VehicleSeed[] = [
    {
      key: "seed-vehicle-territory",
      code: "terr",
      vin: "9BFEB55P4R8123219",
      plate: "ABC1D23",
      model: "Territory Titanium",
      modelYear: 2024,
      manufactureYear: 2024,
      currentMileage: 38450,
      dealership: "sp",
      owner: carlosOwner,
      history: [
        { daysAgo: 34, mileage: 37800, description: "Revisão de 30.000 km", points: 1800 },
        { daysAgo: 228, mileage: 28100, description: "Revisão de 20.000 km", points: 1500 },
        { daysAgo: 402, mileage: 15600, description: "Revisão de 10.000 km", points: 1200 },
      ],
      openOrder: {
        status: ServiceOrderStatus.IN_PROGRESS,
        mileage: 38450,
        description: "Revisão de 40.000 km",
      },
    },
    /** Veículos extras da conta de demonstração para exercitar a Garagem 360. */
    {
      key: "seed-vehicle-carlos-ranger",
      code: "rngc",
      vin: "9BFRG55K5S8124001",
      plate: "RNG5C24",
      model: "Ranger Limited",
      modelYear: 2025,
      manufactureYear: 2024,
      currentMileage: 26540,
      dealership: "sp",
      owner: carlosOwner,
      history: [
        { daysAgo: 92, mileage: 20300, description: "Revisão de 20.000 km" },
        { daysAgo: 286, mileage: 10100, description: "Revisão de 10.000 km" },
      ],
    },
    {
      key: "seed-vehicle-carlos-maverick",
      code: "mavc",
      vin: "9BFMK55L7R8124002",
      plate: "MAV4L24",
      model: "Maverick Lariat",
      modelYear: 2024,
      manufactureYear: 2024,
      currentMileage: 14820,
      dealership: "sp",
      owner: carlosOwner,
      history: [
        { daysAgo: 126, mileage: 10300, description: "Revisão de 10.000 km" },
      ],
    },
    {
      key: "seed-vehicle-carlos-bronco",
      code: "brcc",
      vin: "9BFBG55N3R8124003",
      plate: "BRC4W24",
      model: "Bronco Wildtrak",
      modelYear: 2024,
      manufactureYear: 2024,
      currentMileage: 9280,
      dealership: "sp",
      owner: carlosOwner,
      history: [
        { daysAgo: 74, mileage: 5200, description: "Revisão de 5.000 km" },
      ],
    },
    {
      key: "seed-vehicle-carlos-mache",
      code: "mche",
      vin: "3FMTK3SU5SMA24004",
      plate: "MCH5E25",
      model: "Mustang Mach-E",
      modelYear: 2025,
      manufactureYear: 2025,
      currentMileage: 12640,
      dealership: "sp",
      owner: carlosOwner,
      history: [
        { daysAgo: 48, mileage: 10120, description: "Revisão elétrica de 10.000 km" },
      ],
    },
    {
      key: "seed-vehicle-carlos-f150",
      code: "f15c",
      vin: "1FTFW1E85SFA24005",
      plate: "F150A25",
      model: "F-150 Lariat",
      modelYear: 2025,
      manufactureYear: 2025,
      currentMileage: 33120,
      dealership: "sp",
      owner: carlosOwner,
      history: [
        { daysAgo: 66, mileage: 30200, description: "Revisão de 30.000 km" },
        { daysAgo: 238, mileage: 20150, description: "Revisão de 20.000 km" },
        { daysAgo: 418, mileage: 10080, description: "Revisão de 10.000 km" },
      ],
    },
    {
      key: "seed-vehicle-raptor",
      code: "rapt",
      vin: "9BFCR55J7R8104821",
      plate: "RAP4T66",
      model: "Ranger Raptor",
      modelYear: 2024,
      manufactureYear: 2024,
      currentMileage: 12840,
      dealership: "sp",
      owner: {
        id: "seed-user-juliana",
        cpf: "15350946056",
        rg: "28.114.902-7",
        rgIssuer: "SSP/SP",
        birthDate: "1990-09-03",
        addressZip: "18035420",
        addressStreet: "Rua São Bento",
        addressNumber: "240",
        addressDistrict: "Centro",
        addressCity: "Sorocaba",
        addressState: "SP",
        email: "juliana@ford360.local",
        fullName: "Juliana Alves",
        phone: "15995551109",
      },
      history: [
        { daysAgo: 21, mileage: 12200, description: "Revisão de 10.000 km", points: 800 },
        { daysAgo: 246, mileage: 5100, description: "Revisão de 5.000 km", points: 650 },
      ],
    },
    {
      key: "seed-vehicle-storm",
      code: "storm",
      vin: "9BFBR55T3S8901234",
      plate: "STO7M11",
      model: "Ranger Storm",
      modelYear: 2025,
      manufactureYear: 2024,
      currentMileage: 21600,
      dealership: "sp",
      owner: {
        id: "seed-user-rodrigo",
        cpf: "11144477735",
        rg: "41.229.883-5",
        rgIssuer: "SSP/SP",
        birthDate: "1982-01-27",
        addressZip: "04538133",
        addressStreet: "Avenida Brigadeiro Faria Lima",
        addressNumber: "3477",
        addressDistrict: "Itaim Bibi",
        addressCity: "São Paulo",
        addressState: "SP",
        email: "rodrigo@ford360.local",
        fullName: "Rodrigo Barreto",
        phone: "11987771122",
      },
      history: [
        { daysAgo: 58, mileage: 20400, description: "Revisão de 20.000 km", points: 900 },
        { daysAgo: 289, mileage: 9800, description: "Revisão de 10.000 km", points: 700 },
      ],
      openOrder: {
        status: ServiceOrderStatus.OPEN,
        mileage: 21600,
        description: "Alinhamento e balanceamento",
      },
    },
    {
      key: "seed-vehicle-territory-sel",
      code: "tsel",
      vin: "9BFTE55K2T8445120",
      plate: "TER8L22",
      model: "Territory SEL",
      modelYear: 2023,
      manufactureYear: 2023,
      currentMileage: 44900,
      dealership: "sp",
      owner: {
        id: "seed-user-patricia",
        cpf: "28625649803",
        rg: "33.907.115-2",
        rgIssuer: "SSP/SP",
        birthDate: "1978-11-19",
        addressZip: "01452000",
        addressStreet: "Rua Jerônimo da Veiga",
        addressNumber: "150",
        addressDistrict: "Jardim Europa",
        addressCity: "São Paulo",
        addressState: "SP",
        email: "patricia@ford360.local",
        fullName: "Patrícia Fontes",
        phone: "11986662233",
      },
      history: [
        { daysAgo: 96, mileage: 42100, description: "Revisão de 40.000 km", points: 1100 },
        { daysAgo: 318, mileage: 31500, description: "Troca de pastilhas de freio", points: 500 },
        { daysAgo: 540, mileage: 20800, description: "Revisão de 20.000 km", points: 900 },
      ],
    },
    {
      key: "seed-vehicle-maverick-fx4",
      code: "mfx4",
      vin: "9BFMV9CP8P8552031",
      plate: "MAV9K33",
      model: "Maverick FX4",
      modelYear: 2023,
      manufactureYear: 2023,
      currentMileage: 51200,
      dealership: "sp",
      owner: {
        id: "seed-user-anderson",
        cpf: "40442820135",
        rg: "39.552.741-0",
        rgIssuer: "SSP/SP",
        birthDate: "1988-06-30",
        addressZip: "09080590",
        addressStreet: "Avenida Industrial",
        addressNumber: "900",
        addressDistrict: "Santo Antônio",
        addressCity: "Santo André",
        addressState: "SP",
        email: "anderson@ford360.local",
        fullName: "Anderson Prates",
        phone: "11985553344",
      },
      history: [
        { daysAgo: 430, mileage: 48700, description: "Revisão de 50.000 km", points: 1200 },
        { daysAgo: 726, mileage: 30200, description: "Revisão de 30.000 km", points: 900 },
      ],
    },
    {
      key: "seed-vehicle-ranger",
      code: "rang",
      vin: "9BFZH55L8P8348842",
      plate: "RAN2G44",
      model: "Ranger Limited",
      modelYear: 2023,
      manufactureYear: 2023,
      currentMileage: 62030,
      dealership: "sp",
      owner: {
        id: "seed-user-fernanda",
        cpf: "39053344705",
        rg: "30.881.446-9",
        rgIssuer: "SSP/SP",
        birthDate: "1992-02-14",
        addressZip: "13024110",
        addressStreet: "Rua Coronel Quirino",
        addressNumber: "1200",
        addressDistrict: "Cambuí",
        addressCity: "Campinas",
        addressState: "SP",
        email: "fernanda@ford360.local",
        fullName: "Fernanda Lima",
        phone: "11997773312",
      },
      history: [
        { daysAgo: 284, mileage: 55400, description: "Revisão de 50.000 km", points: 1200 },
        { daysAgo: 612, mileage: 33900, description: "Revisão de 30.000 km", points: 900 },
      ],
      openOrder: {
        status: ServiceOrderStatus.OPEN,
        mileage: 62030,
        description: "Freios e alinhamento",
      },
    },
    {
      key: "seed-vehicle-bronco-wildtrak",
      code: "bwtk",
      vin: "9BFBS55S5N8667742",
      plate: "BRW1P55",
      model: "Bronco Sport Wildtrak",
      modelYear: 2022,
      manufactureYear: 2022,
      currentMileage: 68400,
      dealership: "pr",
      owner: {
        id: "seed-user-helena",
        cpf: "06785162054",
        rg: "12.884.330-6",
        rgIssuer: "SSP/PR",
        birthDate: "1986-08-22",
        addressZip: "80420090",
        addressStreet: "Rua Comendador Araújo",
        addressNumber: "499",
        addressDistrict: "Batel",
        addressCity: "Curitiba",
        addressState: "PR",
        email: "helena@ford360.local",
        fullName: "Helena Rezende",
        phone: "41984442255",
      },
      history: [
        { daysAgo: 47, mileage: 66100, description: "Revisão de 60.000 km", points: 1300 },
        { daysAgo: 265, mileage: 52300, description: "Revisão de 50.000 km", points: 1100 },
        { daysAgo: 505, mileage: 38900, description: "Revisão de 40.000 km", points: 1000 },
      ],
    },
    {
      key: "seed-vehicle-ranger-xls",
      code: "rxls",
      vin: "9BFRL55L9R8778853",
      plate: "RXL2Q66",
      model: "Ranger XLS",
      modelYear: 2024,
      manufactureYear: 2023,
      currentMileage: 29800,
      dealership: "pr",
      owner: {
        id: "seed-user-gustavo",
        cpf: "32432142880",
        rg: "10.552.907-4",
        rgIssuer: "SSP/PR",
        birthDate: "1994-03-08",
        addressZip: "82530200",
        addressStreet: "Avenida Anita Garibaldi",
        addressNumber: "850",
        addressDistrict: "Cabral",
        addressCity: "Curitiba",
        addressState: "PR",
        email: "gustavo@ford360.local",
        fullName: "Gustavo Peixoto",
        phone: "41983331166",
      },
      history: [
        { daysAgo: 73, mileage: 28200, description: "Revisão de 20.000 km", points: 900 },
      ],
      openOrder: {
        status: ServiceOrderStatus.IN_PROGRESS,
        mileage: 29800,
        description: "Revisão de 30.000 km",
      },
    },
    {
      key: "seed-vehicle-maverick",
      code: "mav",
      vin: "9BFEC9CP6N8111190",
      plate: "MAV3H55",
      model: "Maverick Lariat",
      modelYear: 2022,
      manufactureYear: 2022,
      currentMileage: 78000,
      dealership: "pr",
      owner: {
        id: "seed-user-marcos",
        cpf: "71428793860",
        rg: "16.203.774-1",
        rgIssuer: "SSP/PR",
        birthDate: "1980-12-05",
        addressZip: "81200100",
        addressStreet: "Rua Padre Anchieta",
        addressNumber: "2200",
        addressDistrict: "Bigorrilho",
        addressCity: "Curitiba",
        addressState: "PR",
        email: "marcos@ford360.local",
        fullName: "Marcos Oliveira",
        phone: "13996662210",
      },
      history: [
        { daysAgo: 349, mileage: 71200, description: "Revisão de 70.000 km", points: 1300 },
      ],
    },
    {
      key: "seed-vehicle-territory-tit",
      code: "ttit",
      vin: "9BFTC55P7Q8889964",
      plate: "TCT3R77",
      model: "Territory Titanium",
      modelYear: 2022,
      manufactureYear: 2022,
      currentMileage: 73500,
      dealership: "mg",
      owner: {
        id: "seed-user-simone",
        cpf: "24971563792",
        rg: "MG-14.887.220",
        rgIssuer: "SSP/MG",
        birthDate: "1983-07-16",
        addressZip: "30140071",
        addressStreet: "Avenida do Contorno",
        addressNumber: "6480",
        addressDistrict: "Savassi",
        addressCity: "Belo Horizonte",
        addressState: "MG",
        email: "simone@ford360.local",
        fullName: "Simone Vasques",
        phone: "31982225577",
      },
      history: [
        { daysAgo: 63, mileage: 71800, description: "Revisão de 70.000 km", points: 1300 },
        { daysAgo: 301, mileage: 58400, description: "Revisão de 60.000 km", points: 1200 },
      ],
    },
    {
      key: "seed-vehicle-maverick-lariat-mg",
      code: "mklm",
      vin: "9BFMK9CP3M8990075",
      plate: "MKL4S88",
      model: "Maverick Lariat",
      modelYear: 2021,
      manufactureYear: 2021,
      currentMileage: 96800,
      dealership: "mg",
      owner: {
        id: "seed-user-vinicius",
        cpf: "87748248800",
        rg: "MG-11.336.905",
        rgIssuer: "SSP/MG",
        birthDate: "1975-05-29",
        addressZip: "31270901",
        addressStreet: "Avenida Antônio Carlos",
        addressNumber: "6627",
        addressDistrict: "Pampulha",
        addressCity: "Belo Horizonte",
        addressState: "MG",
        email: "vinicius@ford360.local",
        fullName: "Vinícius Camargo",
        phone: "31981116688",
      },
      history: [
        { daysAgo: 468, mileage: 88200, description: "Revisão de 80.000 km", points: 1300 },
      ],
    },
    {
      key: "seed-vehicle-bronco",
      code: "bron",
      vin: "9BFZB55S1M8235910",
      plate: "BRO5N77",
      model: "Bronco Sport",
      modelYear: 2021,
      manufactureYear: 2021,
      currentMileage: 91220,
      dealership: "sp",
      owner: {
        id: "seed-user-eduardo",
        cpf: "35524052880",
        rg: "27.660.118-3",
        rgIssuer: "SSP/SP",
        birthDate: "1972-10-02",
        addressZip: "13201840",
        addressStreet: "Avenida Prefeito Luiz Latorre",
        addressNumber: "1500",
        addressDistrict: "Centro",
        addressCity: "Jundiaí",
        addressState: "SP",
        email: "eduardo@ford360.local",
        fullName: "Eduardo Moraes",
        phone: "11994440098",
      },
      history: [
        { daysAgo: 842, mileage: 74300, description: "Revisão de 70.000 km" },
      ],
    },
    // Cliente recém-chegado: não possui revisão porque a entrega foi há poucas
    // semanas. Ele serve para demonstrar que "sem histórico" não é evasão.
    {
      key: "seed-vehicle-new-territory",
      code: "newterr",
      vin: "9BFTR55P6V8123456",
      plate: "NVA2D26",
      model: "Territory Titanium",
      modelYear: 2026,
      manufactureYear: 2025,
      currentMileage: 680,
      dealership: "sp",
      ownershipDaysAgo: 21,
      owner: {
        id: "seed-user-marina",
        cpf: "38165472909",
        rg: "55.210.987-2",
        rgIssuer: "SSP/SP",
        birthDate: "1994-05-18",
        addressZip: "05422970",
        addressStreet: "Rua Harmonia",
        addressNumber: "423",
        addressDistrict: "Vila Madalena",
        addressCity: "São Paulo",
        addressState: "SP",
        email: "marina.azevedo@ford360.local",
        fullName: "Marina Azevedo",
        phone: "11987654321",
      },
      history: [],
    },
    // Transferência de proprietário: a identidade do VIN e as revisões ficam
    // preservadas, mas o relacionamento com a nova dona começa agora.
    {
      key: "seed-vehicle-transfer",
      code: "transf",
      vin: "9BFTS55K4R8456789",
      plate: "TRN4F24",
      model: "Territory SEL",
      modelYear: 2024,
      manufactureYear: 2024,
      currentMileage: 28400,
      dealership: "sp",
      ownershipDaysAgo: 28,
      owner: {
        id: "seed-user-beatriz",
        cpf: "24681357928",
        rg: "48.621.390-4",
        rgIssuer: "SSP/SP",
        birthDate: "1991-12-09",
        addressZip: "04567000",
        addressStreet: "Rua das Acácias",
        addressNumber: "88",
        addressDistrict: "Moema",
        addressCity: "São Paulo",
        addressState: "SP",
        email: "beatriz.monteiro@ford360.local",
        fullName: "Beatriz Monteiro",
        phone: "11976543210",
      },
      history: [
        { daysAgo: 126, mileage: 25100, description: "Revisão de 20.000 km", points: 900 },
        { daysAgo: 356, mileage: 10100, description: "Revisão de 10.000 km", points: 700 },
      ],
    },
  ];

  for (const item of fleet) {
    const dealershipId = dealerships[item.dealership].id;
    const isCompany = item.owner.customerType === "COMPANY";
    const profile = {
      fullName: item.owner.fullName,
      phone: item.owner.phone,
      customerType: isCompany ? "COMPANY" : "INDIVIDUAL",
      cpf: isCompany ? null : item.owner.cpf ?? null,
      cnpj: isCompany ? item.owner.cnpj ?? null : null,
      tradeName: isCompany ? item.owner.tradeName ?? null : null,
      stateRegistration: isCompany ? item.owner.stateRegistration ?? null : null,
      stateRegistrationExempt: false,
      companyRegistrationStatus: isCompany ? item.owner.companyRegistrationStatus ?? null : null,
      legalRepresentativeName: isCompany ? item.owner.legalRepresentativeName ?? null : null,
      legalRepresentativeCpf: isCompany ? item.owner.legalRepresentativeCpf ?? null : null,
      legalRepresentativeDocument: isCompany ? item.owner.legalRepresentativeDocument ?? null : null,
      legalRepresentativeRole: isCompany ? item.owner.legalRepresentativeRole ?? null : null,
      representationBasis: isCompany ? item.owner.representationBasis ?? null : null,
      representationDocumentChecked: isCompany ? Boolean(item.owner.representationDocumentChecked) : false,
      rg: isCompany ? null : item.owner.rg ?? null,
      rgIssuer: isCompany ? null : item.owner.rgIssuer ?? null,
      birthDate: !isCompany && item.owner.birthDate ? new Date(`${item.owner.birthDate}T12:00:00Z`) : null,
      addressZip: item.owner.addressZip,
      addressStreet: item.owner.addressStreet,
      addressNumber: item.owner.addressNumber,
      addressDistrict: item.owner.addressDistrict,
      addressCity: item.owner.addressCity,
      addressState: item.owner.addressState,
    };
    const owner = await prisma.user.upsert({
      where: { email: item.owner.email },
      update: { ...profile, passwordHash, registeredByDealershipId: dealershipId },
      create: {
        id: item.owner.id,
        email: item.owner.email,
        ...profile,
        passwordHash,
        role: UserRole.CUSTOMER,
        registeredByDealershipId: dealershipId,
      },
    });
    // O saldo é recalculado ao final, a partir das movimentações, para que
    // "gerados − resgatados = saldo" sempre feche no painel de fidelidade.
    const loyalty = await prisma.loyaltyAccount.upsert({
      where: { userId: owner.id },
      update: {},
      create: { userId: owner.id, balance: 0 },
    });
    await prisma.vehicle.upsert({
      where: { vin: item.vin },
      update: {
        currentMileage: item.currentMileage,
        originDealershipId: dealershipId,
        // Garante que um veículo usado numa demonstração de troca volte ao
        // estado de "com proprietário", e não ao estoque.
        saleStatus: null,
        stockDealershipId: null,
        stockSince: null,
        listPrice: null,
      },
      create: {
        id: item.key,
        vin: item.vin,
        plate: item.plate,
        model: item.model,
        modelYear: item.modelYear,
        manufactureYear: item.manufactureYear,
        currentMileage: item.currentMileage,
        originDealershipId: dealershipId,
      },
    });
    await prisma.vehicleOwnership.upsert({
      where: { id: `own-${item.key}` },
      update: {
        status: OwnershipStatus.ACTIVE,
        startedAt: daysAgo(item.ownershipDaysAgo ?? item.history[item.history.length - 1]?.daysAgo ?? 400),
        endedAt: null,
      },
      create: {
        id: `own-${item.key}`,
        vehicleId: item.key,
        userId: owner.id,
        status: OwnershipStatus.ACTIVE,
        startedAt: daysAgo(item.ownershipDaysAgo ?? item.history[item.history.length - 1]?.daysAgo ?? 400),
      },
    });

    for (const [index, service] of item.history.entries()) {
      const orderId = `os-${item.code}-${index}`;
      const completedAt = daysAgo(service.daysAgo, 9 + index, 30);
      // Valor do atendimento: base da receita de pós-venda por VIN.
      const amount = service.points ? Math.round(service.points * 1.2) : 1200;
      await prisma.serviceOrder.upsert({
        where: { id: orderId },
        update: { completedAt, status: ServiceOrderStatus.COMPLETED, amount },
        create: {
          id: orderId,
          vehicleId: item.key,
          dealershipId,
          mileage: service.mileage,
          status: ServiceOrderStatus.COMPLETED,
          description: service.description,
          amount,
          completedAt,
          createdAt: completedAt,
        },
      });
      if (service.points)
        await prisma.pointTransaction.upsert({
          where: { id: `pts-${item.code}-${index}` },
          update: {
            amount: service.points,
            reason: service.description,
            createdAt: completedAt,
          },
          create: {
            id: `pts-${item.code}-${index}`,
            loyaltyAccountId: loyalty.id,
            serviceOrderId: orderId,
            amount: service.points,
            reason: service.description,
            createdAt: completedAt,
          },
        });
    }

    if (item.openOrder)
      await prisma.serviceOrder.upsert({
        where: { id: `os-${item.code}-open` },
        // Concluir a OS numa demonstração muda status, quilometragem e
        // completedAt: os três precisam voltar, senão a base drena.
        update: {
          status: item.openOrder.status,
          mileage: item.openOrder.mileage,
          description: item.openOrder.description,
          completedAt: null,
        },
        create: {
          id: `os-${item.code}-open`,
          vehicleId: item.key,
          dealershipId,
          mileage: item.openOrder.mileage,
          status: item.openOrder.status,
          description: item.openOrder.description,
          createdAt: daysAgo(2, 8, 15),
        },
      });
  }

  const formerTransferOwner = await prisma.user.upsert({
    where: { email: "roberto.souza@ford360.local" },
    update: {
      fullName: "Roberto Souza",
      phone: "11991234567",
      customerType: "INDIVIDUAL",
      cpf: "98765432100",
      cnpj: null,
      active: true,
    },
    create: {
      id: "seed-user-roberto-transfer",
      email: "roberto.souza@ford360.local",
      passwordHash,
      fullName: "Roberto Souza",
      phone: "11991234567",
      customerType: "INDIVIDUAL",
      cpf: "98765432100",
      rg: "41.887.552-0",
      rgIssuer: "SSP/SP",
      birthDate: new Date("1984-03-21T12:00:00Z"),
      addressZip: "04567000",
      addressStreet: "Rua das Acácias",
      addressNumber: "88",
      addressDistrict: "Moema",
      addressCity: "São Paulo",
      addressState: "SP",
      role: UserRole.CUSTOMER,
      registeredByDealershipId: dealerships.sp.id,
    },
  });
  await prisma.vehicleOwnership.upsert({
    where: { id: "own-seed-vehicle-transfer-former" },
    update: { status: OwnershipStatus.ENDED, startedAt: daysAgo(610), endedAt: daysAgo(28) },
    create: {
      id: "own-seed-vehicle-transfer-former",
      vehicleId: "seed-vehicle-transfer",
      userId: formerTransferOwner.id,
      status: OwnershipStatus.ENDED,
      startedAt: daysAgo(610),
      endedAt: daysAgo(28),
    },
  });

  // Agenda da oficina: dia corrente com operação em andamento e próximos dias
  // úteis reservados, sempre dentro do expediente da unidade.
  const agenda = [
    {
      id: "seed-booking-bronco",
      vehicleId: "seed-vehicle-bronco",
      userId: "seed-user-eduardo",
      dealership: "sp" as const,
      requestedFor: businessDayAhead(0, 8, 0),
      status: BookingStatus.COMPLETED,
      notes: "Diagnóstico eletrônico e orçamento",
    },
    {
      id: "seed-booking-territory-sel",
      vehicleId: "seed-vehicle-territory-sel",
      userId: "seed-user-patricia",
      dealership: "sp" as const,
      requestedFor: businessDayAhead(0, 8, 30),
      status: BookingStatus.COMPLETED,
      notes: "Recall FORD-26-AX7 e revisão",
    },
    {
      id: "seed-booking-territory",
      vehicleId: "seed-vehicle-territory",
      userId: "seed-user-carlos",
      dealership: "sp" as const,
      // A entrada na oficina que originou a OS aberta já aconteceu. Mantê-la
      // concluída evita que o app anuncie um compromisso passado como próximo.
      requestedFor: daysAgo(2, 9, 30),
      status: BookingStatus.COMPLETED,
      notes: "Revisão de 40.000 km",
    },
    {
      id: "seed-booking-maverick-fx4",
      vehicleId: "seed-vehicle-maverick-fx4",
      userId: "seed-user-anderson",
      dealership: "sp" as const,
      requestedFor: businessDayAhead(0, 10, 0),
      status: BookingStatus.CONFIRMED,
      notes: "Revisão de 60.000 km e troca de óleo",
    },
    {
      id: "seed-booking-storm",
      vehicleId: "seed-vehicle-storm",
      userId: "seed-user-rodrigo",
      dealership: "sp" as const,
      requestedFor: businessDayAhead(0, 11, 0),
      status: BookingStatus.CONFIRMED,
      notes: "Alinhamento e balanceamento",
    },
    {
      id: "seed-booking-raptor",
      vehicleId: "seed-vehicle-raptor",
      userId: "seed-user-juliana",
      dealership: "sp" as const,
      requestedFor: businessDayAhead(0, 13, 30),
      status: BookingStatus.CONFIRMED,
      notes: "Instalação de acessórios",
    },
    {
      id: "seed-booking-ranger",
      vehicleId: "seed-vehicle-ranger",
      userId: "seed-user-fernanda",
      dealership: "sp" as const,
      requestedFor: businessDayAhead(0, 14, 30),
      status: BookingStatus.REQUESTED,
      notes: "Verificar sistema de freios",
    },
    {
      id: "seed-booking-territory-2",
      vehicleId: "seed-vehicle-territory",
      userId: "seed-user-carlos",
      dealership: "sp" as const,
      requestedFor: businessDayAhead(3, 9, 0),
      status: BookingStatus.REQUESTED,
      notes: "Retorno para revisão do ar-condicionado",
    },
    {
      id: "seed-booking-ranger-xls",
      vehicleId: "seed-vehicle-ranger-xls",
      userId: "seed-user-gustavo",
      dealership: "pr" as const,
      requestedFor: businessDayAhead(1, 13, 30),
      status: BookingStatus.CONFIRMED,
      notes: "Revisão de 30.000 km",
    },
    {
      id: "seed-booking-territory-tit",
      vehicleId: "seed-vehicle-territory-tit",
      userId: "seed-user-simone",
      dealership: "mg" as const,
      requestedFor: businessDayAhead(2, 10, 30),
      status: BookingStatus.CONFIRMED,
      notes: "Revisão de 80.000 km",
    },
  ];
  for (const booking of agenda)
    await prisma.booking.upsert({
      where: { id: booking.id },
      update: {
        requestedFor: booking.requestedFor,
        status: booking.status,
        notes: booking.notes,
      },
      create: {
        id: booking.id,
        vehicleId: booking.vehicleId,
        userId: booking.userId,
        dealershipId: dealerships[booking.dealership].id,
        requestedFor: booking.requestedFor,
        status: booking.status,
        notes: booking.notes,
      },
    });

  // Estoque disponível para venda. O VIN já existe desde a fábrica: a venda
  // apenas vincula o primeiro proprietário.
  const stock = [
    {
      vin: "9BFNR55T1V8112233",
      plate: null,
      model: "Ranger XLT",
      modelYear: 2026,
      manufactureYear: 2025,
      currentMileage: 0,
      condition: VehicleCondition.NEW,
      listPrice: 289900,
      dealership: "sp" as const,
      stockDays: 22,
    },
    {
      vin: "9BFTN55K5V8223344",
      plate: null,
      model: "Territory Titanium",
      modelYear: 2026,
      manufactureYear: 2025,
      currentMileage: 0,
      condition: VehicleCondition.NEW,
      listPrice: 219900,
      dealership: "sp" as const,
      stockDays: 9,
    },
    {
      vin: "9BFMN9CP7V8334455",
      plate: null,
      model: "Maverick Lariat",
      modelYear: 2026,
      manufactureYear: 2025,
      currentMileage: 0,
      condition: VehicleCondition.NEW,
      listPrice: 259900,
      dealership: "sp" as const,
      stockDays: 41,
    },
    {
      vin: "9BFBN55S3V8445566",
      plate: null,
      model: "Bronco Sport Wildtrak",
      modelYear: 2026,
      manufactureYear: 2025,
      currentMileage: 0,
      condition: VehicleCondition.NEW,
      listPrice: 279900,
      dealership: "pr" as const,
      stockDays: 15,
    },
    {
      vin: "9BFRU55L2S8556677",
      plate: "USA6T99",
      model: "Ranger Storm",
      modelYear: 2024,
      manufactureYear: 2023,
      currentMileage: 47300,
      condition: VehicleCondition.USED,
      listPrice: 198000,
      dealership: "sp" as const,
      stockDays: 12,
      // Usado retomado em troca: entra no estoque com o histórico preservado,
      // que vira argumento de venda.
      history: [
        { daysAgo: 120, mileage: 44100, description: "Revisão de 40.000 km", amount: 1450 },
        { daysAgo: 380, mileage: 28600, description: "Revisão de 20.000 km", amount: 1180 },
      ],
    },
  ];
  for (const item of stock) {
    const dealershipId = dealerships[item.dealership].id;
    const stockSince = daysAgo(item.stockDays, 9);
    await prisma.vehicle.upsert({
      where: { vin: item.vin },
      update: {
        saleStatus: VehicleSaleStatus.IN_STOCK,
        stockDealershipId: dealershipId,
        stockSince,
        listPrice: item.listPrice,
        condition: item.condition,
      },
      create: {
        vin: item.vin,
        plate: item.plate,
        model: item.model,
        modelYear: item.modelYear,
        manufactureYear: item.manufactureYear,
        currentMileage: item.currentMileage,
        condition: item.condition,
        saleStatus: VehicleSaleStatus.IN_STOCK,
        stockDealershipId: dealershipId,
        stockSince,
        listPrice: item.listPrice,
        originDealershipId:
          item.condition === VehicleCondition.NEW ? dealershipId : null,
      },
    });
    const stockVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { vin: item.vin },
      select: { id: true },
    });
    // Veículo em estoque não tem proprietário ativo.
    await prisma.vehicleOwnership.deleteMany({
      where: { vehicleId: stockVehicle.id },
    });
    for (const [index, service] of (item.history ?? []).entries()) {
      const completedAt = daysAgo(service.daysAgo, 10, 30);
      await prisma.serviceOrder.upsert({
        where: { id: `os-stock-${index}` },
        update: { completedAt, amount: service.amount },
        create: {
          id: `os-stock-${index}`,
          vehicleId: stockVehicle.id,
          dealershipId,
          mileage: service.mileage,
          status: ServiceOrderStatus.COMPLETED,
          description: service.description,
          amount: service.amount,
          completedAt,
          createdAt: completedAt,
        },
      });
    }
  }

  // Vendas já realizadas: alimentam a receita e o histórico comercial.
  const pastSales = [
    // Entrega recente: a ausência de OS é esperada nesta fase e não pode virar
    // alerta de evasão para a equipe comercial.
    { code: "newterr", vehicleKey: "seed-vehicle-new-territory", customer: "seed-user-marina", dealership: "sp" as const, daysAgo: 21, price: 229900, seller: "seed-user-agent" },
    { code: "rxls", vehicleKey: "seed-vehicle-ranger-xls", customer: "seed-user-gustavo", dealership: "pr" as const, daysAgo: 190, price: 268900, seller: "seed-user-manager-pr" },
    { code: "rapt", vehicleKey: "seed-vehicle-raptor", customer: "seed-user-juliana", dealership: "sp" as const, daysAgo: 300, price: 419900, seller: "seed-user-agent" },
    { code: "storm", vehicleKey: "seed-vehicle-storm", customer: "seed-user-rodrigo", dealership: "sp" as const, daysAgo: 330, price: 284900, seller: "seed-user-agent" },
    { code: "ttit", vehicleKey: "seed-vehicle-territory-tit", customer: "seed-user-simone", dealership: "mg" as const, daysAgo: 340, price: 209900, seller: "seed-user-manager-mg" },
    { code: "terr", vehicleKey: "seed-vehicle-territory", customer: "seed-user-carlos", dealership: "sp" as const, daysAgo: 430, price: 214900, seller: "seed-user-agent" },
  ];
  for (const sale of pastSales) {
    const soldAt = daysAgo(sale.daysAgo, 15);
    const warrantyUntil = new Date(soldAt);
    warrantyUntil.setMonth(warrantyUntil.getMonth() + 36);
    await prisma.sale.upsert({
      where: { id: `sale-${sale.code}` },
      update: { price: sale.price, soldAt },
      create: {
        id: `sale-${sale.code}`,
        vehicleId: sale.vehicleKey,
        dealershipId: dealerships[sale.dealership].id,
        customerId: sale.customer,
        soldById: sale.seller,
        condition: VehicleCondition.NEW,
        price: sale.price,
        warrantyMonths: 36,
        soldAt,
      },
    });
    await prisma.vehicle.update({
      where: { id: sale.vehicleKey },
      data: { saleStatus: VehicleSaleStatus.SOLD, warrantyUntil },
    });
  }

  const carlosLoyalty = await prisma.loyaltyAccount.findUniqueOrThrow({
    where: { userId: "seed-user-carlos" },
  });
  const helenaLoyalty = await prisma.loyaltyAccount.findUniqueOrThrow({
    where: { userId: "seed-user-helena" },
  });
  const vouchers = [
    {
      id: "seed-voucher-carlos",
      code: "FORD250-CARLOS",
      loyaltyAccountId: carlosLoyalty.id,
      title: "R$ 250 na próxima revisão",
      pointsCost: 2500,
      status: VoucherStatus.AVAILABLE,
      expiresAt: monthsAhead(4),
      redeemedAt: null,
    },
    {
      id: "seed-voucher-carlos-used",
      code: "FORD120-CARLOS",
      loyaltyAccountId: carlosLoyalty.id,
      title: "R$ 120 em peças e acessórios",
      pointsCost: 1200,
      status: VoucherStatus.REDEEMED,
      expiresAt: monthsAhead(1),
      redeemedAt: daysAgo(34, 15),
    },
    {
      id: "seed-voucher-helena",
      code: "FORD180-HELENA",
      loyaltyAccountId: helenaLoyalty.id,
      title: "R$ 180 na revisão programada",
      pointsCost: 1800,
      status: VoucherStatus.AVAILABLE,
      expiresAt: monthsAhead(3),
      redeemedAt: null,
    },
  ];
  for (const voucher of vouchers) {
    await prisma.voucher.upsert({
      where: { code: voucher.code },
      update: { status: voucher.status, redeemedAt: voucher.redeemedAt },
      create: voucher,
    });
    // A emissão do benefício debita os pontos, como no fluxo real da API.
    await prisma.pointTransaction.upsert({
      where: { id: `pts-${voucher.id.replace("seed-voucher-", "vc-")}` },
      update: { amount: -voucher.pointsCost },
      create: {
        id: `pts-${voucher.id.replace("seed-voucher-", "vc-")}`,
        loyaltyAccountId: voucher.loyaltyAccountId,
        amount: -voucher.pointsCost,
        reason: `Emissão: ${voucher.title}`,
        createdAt: voucher.redeemedAt ?? daysAgo(20, 14),
      },
    });
  }

  for (const account of await prisma.loyaltyAccount.findMany({
    select: { id: true },
  })) {
    const movement = await prisma.pointTransaction.aggregate({
      where: { loyaltyAccountId: account.id },
      _sum: { amount: true },
    });
    await prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { balance: movement._sum.amount ?? 0 },
    });
  }

  const campaigns = [
    {
      id: "seed-campaign-ranger",
      name: "Check-up Ranger 5+",
      description:
        "Retenção de proprietários Ranger com revisão vencida na rede autorizada.",
      publicTitle: "Check-up especial para sua Ranger",
      publicDescription:
        "Faça uma avaliação preventiva na rede Ford e viaje com mais tranquilidade.",
      publicCtaLabel: "Agendar check-up",
      publicCtaLink: "/agendamentos",
      startsAt: daysAgo(35),
      endsAt: monthsAhead(2),
      active: true,
      targets: [
        { vehicleId: "seed-vehicle-ranger", sentAt: daysAgo(30), convertedAt: null },
        { vehicleId: "seed-vehicle-ranger-xls", sentAt: daysAgo(30), convertedAt: daysAgo(12) },
        { vehicleId: "seed-vehicle-storm", sentAt: daysAgo(29), convertedAt: daysAgo(18) },
      ],
    },
    {
      id: "seed-campaign-retorno",
      name: "Retorno Seguro Territory",
      description:
        "Reativação de clientes Territory sem passagem pela rede há mais de 12 meses.",
      publicTitle: "Seu Territory merece cuidado Ford",
      publicDescription:
        "Volte à rede autorizada para uma avaliação completa com técnicos especializados.",
      publicCtaLabel: "Escolher horário",
      publicCtaLink: "/agendamentos",
      startsAt: daysAgo(12),
      endsAt: monthsAhead(1),
      active: true,
      targets: [
        { vehicleId: "seed-vehicle-territory-sel", sentAt: daysAgo(10), convertedAt: daysAgo(3) },
        { vehicleId: "seed-vehicle-territory-tit", sentAt: daysAgo(10), convertedAt: null },
      ],
    },
    {
      id: "seed-campaign-inverno",
      name: "Campanha Inverno Ford",
      description:
        "Checagem gratuita de bateria, freios e pneus para toda a carteira ativa.",
      publicTitle: "Check-up de inverno Ford",
      publicDescription:
        "Conte com uma checagem preventiva de bateria, freios e pneus.",
      publicCtaLabel: "Ver detalhes",
      publicCtaLink: "/agendamentos",
      startsAt: daysAgo(210),
      endsAt: daysAgo(120),
      active: false,
      targets: [
        { vehicleId: "seed-vehicle-maverick", sentAt: daysAgo(205), convertedAt: daysAgo(190) },
        { vehicleId: "seed-vehicle-bronco-wildtrak", sentAt: daysAgo(205), convertedAt: daysAgo(196) },
      ],
    },
    {
      id: "seed-campaign-territory-care",
      name: "Ford Care Territory ativo",
      description:
        "Oferta de pós-venda para proprietários Territory com consentimento de marketing ativo.",
      publicTitle: "10% de cuidado extra para seu Territory",
      publicDescription:
        "Aproveite 10% de desconto na higienização do ar-condicionado junto ao próximo serviço.",
      publicCtaLabel: "Quero agendar",
      publicCtaLink: "/agendamentos",
      startsAt: daysAgo(5),
      endsAt: monthsAhead(1),
      active: true,
      targets: [
        { vehicleId: "seed-vehicle-territory", sentAt: daysAgo(4), convertedAt: null },
      ],
    },
    // Caso de resultado mensurável: a recuperação começa na campanha e termina
    // em uma troca concluída, sem atribuir a ação diretamente à IA.
    {
      id: "seed-campaign-troca-maverick",
      name: "Troca Programada Maverick",
      description:
        "Contato aprovado pela equipe para clientes Maverick com alta propensão à troca.",
      publicTitle: "Seu próximo Ford pode começar com seu Maverick",
      publicDescription:
        "Agende uma avaliação do seu veículo e conheça as condições de troca disponíveis.",
      publicCtaLabel: "Agendar avaliação",
      publicCtaLink: "/agendamentos",
      startsAt: daysAgo(50),
      endsAt: daysAgo(20),
      active: false,
      targets: [
        { vehicleId: "seed-vehicle-maverick-lariat-mg", sentAt: daysAgo(46), convertedAt: daysAgo(42) },
      ],
    },
  ];
  for (const campaign of campaigns) {
    const record = await prisma.campaign.upsert({
      where: { id: campaign.id },
      update: {
        name: campaign.name,
        description: campaign.description,
        publicTitle: campaign.publicTitle,
        publicDescription: campaign.publicDescription,
        publicCtaLabel: campaign.publicCtaLabel,
        publicCtaLink: campaign.publicCtaLink,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
        active: campaign.active,
      },
      create: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        publicTitle: campaign.publicTitle,
        publicDescription: campaign.publicDescription,
        publicCtaLabel: campaign.publicCtaLabel,
        publicCtaLink: campaign.publicCtaLink,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
        active: campaign.active,
      },
    });
    for (const target of campaign.targets)
      await prisma.campaignTarget.upsert({
        where: {
          campaignId_vehicleId: {
            campaignId: record.id,
            vehicleId: target.vehicleId,
          },
        },
        update: { sentAt: target.sentAt, convertedAt: target.convertedAt },
        create: {
          campaignId: record.id,
          vehicleId: target.vehicleId,
          sentAt: target.sentAt,
          convertedAt: target.convertedAt,
        },
      });
  }

  const leads = [
    {
      id: "seed-lead-bronco",
      vehicleId: "seed-vehicle-bronco",
      ownerId: "seed-user-eduardo",
      dealership: "sp" as const,
      score: 98,
      estimatedValue: 108000,
      status: RepurchaseLeadStatus.CONTACTED,
      notes: "Cliente sem passagem na rede há mais de 2 anos. Contato realizado.",
      contactedAt: daysAgo(4, 16),
      events: [
        { from: null, to: RepurchaseLeadStatus.NEW, notes: "Oportunidade identificada pelo score de recompra." },
        { from: RepurchaseLeadStatus.NEW, to: RepurchaseLeadStatus.CONTACTED, notes: "Primeiro contato realizado por telefone." },
      ],
    },
    {
      id: "seed-lead-maverick",
      vehicleId: "seed-vehicle-maverick",
      ownerId: "seed-user-marcos",
      dealership: "pr" as const,
      score: 87,
      estimatedValue: 97000,
      status: RepurchaseLeadStatus.QUALIFIED,
      notes: "Interesse em Ranger XLS 2026. Avaliação do usado agendada.",
      contactedAt: daysAgo(9, 11),
      events: [
        { from: null, to: RepurchaseLeadStatus.NEW, notes: "Veículo com 78.000 km e 4 anos de uso." },
        { from: RepurchaseLeadStatus.NEW, to: RepurchaseLeadStatus.CONTACTED, notes: "Cliente respondeu a campanha de e-mail." },
        { from: RepurchaseLeadStatus.CONTACTED, to: RepurchaseLeadStatus.QUALIFIED, notes: "Proposta de troca em elaboração." },
      ],
    },
    {
      id: "seed-lead-maverick-mg",
      vehicleId: "seed-vehicle-maverick-lariat-mg",
      ownerId: "seed-user-vinicius",
      dealership: "mg" as const,
      score: 92,
      estimatedValue: 88000,
      status: RepurchaseLeadStatus.WON,
      notes: "Troca concluída por Maverick 2026.",
      contactedAt: daysAgo(46, 10),
      closedAt: daysAgo(21, 17),
      events: [
        { from: null, to: RepurchaseLeadStatus.NEW, notes: "Alto índice de propensão à troca." },
        { from: RepurchaseLeadStatus.NEW, to: RepurchaseLeadStatus.CONTACTED, notes: "Visita à concessionária agendada." },
        { from: RepurchaseLeadStatus.CONTACTED, to: RepurchaseLeadStatus.QUALIFIED, notes: "Test-drive realizado." },
        { from: RepurchaseLeadStatus.QUALIFIED, to: RepurchaseLeadStatus.WON, notes: "Negócio fechado com entrada do usado." },
      ],
    },
    {
      id: "seed-lead-territory-sel",
      vehicleId: "seed-vehicle-territory-sel",
      ownerId: "seed-user-patricia",
      dealership: "sp" as const,
      score: 74,
      estimatedValue: 132000,
      status: RepurchaseLeadStatus.NEW,
      notes: "Oportunidade gerada automaticamente pelo painel de recompra.",
      contactedAt: null,
      events: [
        { from: null, to: RepurchaseLeadStatus.NEW, notes: "Oportunidade gerada automaticamente." },
      ],
    },
    {
      id: "seed-lead-maverick-fx4",
      vehicleId: "seed-vehicle-maverick-fx4",
      ownerId: "seed-user-anderson",
      dealership: "sp" as const,
      score: 84,
      estimatedValue: 142000,
      status: RepurchaseLeadStatus.LOST,
      notes: "Cliente foi contatado, mas não demonstrou interesse no momento.",
      contactedAt: daysAgo(30, 10),
      closedAt: daysAgo(14, 16),
      events: [
        { from: null, to: RepurchaseLeadStatus.NEW, notes: "Oportunidade identificada após longo período sem retorno." },
        { from: RepurchaseLeadStatus.NEW, to: RepurchaseLeadStatus.CONTACTED, notes: "Contato aprovado e realizado pela consultora." },
        { from: RepurchaseLeadStatus.CONTACTED, to: RepurchaseLeadStatus.LOST, notes: "Cliente informou que não deseja negociar neste momento." },
      ],
    },
  ];
  for (const lead of leads) {
    const record = await prisma.repurchaseLead.upsert({
      where: {
        vehicleId_dealershipId: {
          vehicleId: lead.vehicleId,
          dealershipId: dealerships[lead.dealership].id,
        },
      },
      update: {
        score: lead.score,
        estimatedValue: lead.estimatedValue,
        status: lead.status,
        notes: lead.notes,
        contactedAt: lead.contactedAt,
        closedAt: "closedAt" in lead ? (lead.closedAt as Date) : null,
      },
      create: {
        id: lead.id,
        vehicleId: lead.vehicleId,
        ownerId: lead.ownerId,
        dealershipId: dealerships[lead.dealership].id,
        createdById: "seed-user-manager",
        score: lead.score,
        estimatedValue: lead.estimatedValue,
        status: lead.status,
        notes: lead.notes,
        contactedAt: lead.contactedAt,
        closedAt: "closedAt" in lead ? (lead.closedAt as Date) : null,
      },
    });
    for (const [index, event] of lead.events.entries())
      await prisma.repurchaseLeadEvent.upsert({
        where: { id: `${lead.id}-ev-${index}` },
        update: {},
        create: {
          id: `${lead.id}-ev-${index}`,
          leadId: record.id,
          performedById: "seed-user-manager",
          fromStatus: event.from,
          toStatus: event.to,
          notes: event.notes,
          createdAt: daysAgo(50 - index * 8, 14),
        },
      });
  }

  const recalls = [
    {
      id: "seed-recall-ax7",
      code: "FORD-26-AX7",
      title: "Inspeção preventiva do chicote do motor",
      description:
        "Campanha preventiva para inspeção e, se necessário, substituição gratuita do componente na rede autorizada Ford.",
      severity: RecallSeverity.HIGH,
      startsAt: daysAgo(24),
      active: true,
      targets: [
        { vehicleId: "seed-vehicle-territory", status: RecallTargetStatus.SCHEDULED, notifiedAt: daysAgo(20), completedAt: null },
        { vehicleId: "seed-vehicle-territory-sel", status: RecallTargetStatus.CONTACTED, notifiedAt: daysAgo(20), completedAt: null },
        { vehicleId: "seed-vehicle-territory-tit", status: RecallTargetStatus.COMPLETED, notifiedAt: daysAgo(22), completedAt: daysAgo(6) },
        { vehicleId: "seed-vehicle-ranger", status: RecallTargetStatus.PENDING, notifiedAt: null, completedAt: null },
      ],
    },
    {
      id: "seed-recall-bt2",
      code: "FORD-25-BT2",
      title: "Atualização de software do módulo de tração",
      description:
        "Atualização gratuita do software de controle de tração, realizada em até 60 minutos na rede autorizada.",
      severity: RecallSeverity.MEDIUM,
      startsAt: daysAgo(190),
      active: false,
      targets: [
        { vehicleId: "seed-vehicle-bronco-wildtrak", status: RecallTargetStatus.COMPLETED, notifiedAt: daysAgo(185), completedAt: daysAgo(160) },
        { vehicleId: "seed-vehicle-raptor", status: RecallTargetStatus.COMPLETED, notifiedAt: daysAgo(185), completedAt: daysAgo(150) },
      ],
    },
  ];
  for (const recall of recalls) {
    const record = await prisma.recall.upsert({
      where: { code: recall.code },
      update: { active: recall.active, startsAt: recall.startsAt },
      create: {
        id: recall.id,
        code: recall.code,
        title: recall.title,
        description: recall.description,
        severity: recall.severity,
        active: recall.active,
        startsAt: recall.startsAt,
      },
    });
    for (const target of recall.targets)
      await prisma.recallTarget.upsert({
        where: {
          recallId_vehicleId: {
            recallId: record.id,
            vehicleId: target.vehicleId,
          },
        },
        update: {
          status: target.status,
          notifiedAt: target.notifiedAt,
          completedAt: target.completedAt,
        },
        create: {
          recallId: record.id,
          vehicleId: target.vehicleId,
          status: target.status,
          notifiedAt: target.notifiedAt,
          completedAt: target.completedAt,
        },
      });
  }

  const tickets = [
    {
      id: "seed-ticket-agenda",
      requesterId: "seed-user-agent",
      dealership: "sp" as const,
      assignedToId: "seed-user-manager",
      subject: "Capacidade da agenda às sextas-feiras",
      message:
        "Precisamos avaliar o aumento de atendimentos simultâneos nas sextas, quando a procura por revisão é maior.",
      category: SupportTicketCategory.SCHEDULING,
      priority: SupportTicketPriority.NORMAL,
      status: SupportTicketStatus.IN_PROGRESS,
      resolution: "Análise de capacidade em andamento com a operação.",
      createdAt: daysAgo(5, 9),
    },
    {
      id: "seed-ticket-integracao",
      requesterId: "seed-user-manager-pr",
      dealership: "pr" as const,
      assignedToId: null,
      subject: "Importação do histórico do DMS legado",
      message:
        "Solicito orientação para importar o histórico de ordens de serviço do sistema anterior da unidade.",
      category: SupportTicketCategory.DATA_INTEGRATION,
      priority: SupportTicketPriority.HIGH,
      status: SupportTicketStatus.OPEN,
      resolution: null,
      createdAt: daysAgo(2, 14),
    },
    {
      id: "seed-ticket-acesso",
      requesterId: "seed-user-agent",
      dealership: "sp" as const,
      assignedToId: "seed-user-manager",
      subject: "Acesso de nova consultora",
      message:
        "Convite enviado para a nova consultora não foi recebido no e-mail corporativo.",
      category: SupportTicketCategory.ACCESS,
      priority: SupportTicketPriority.NORMAL,
      status: SupportTicketStatus.RESOLVED,
      resolution:
        "Convite reenviado pela fila transacional e ativado com sucesso pela consultora.",
      createdAt: daysAgo(16, 11),
      resolvedAt: daysAgo(15, 16),
    },
    {
      id: "seed-ticket-cliente",
      requesterId: "seed-user-carlos",
      dealership: null,
      assignedToId: "seed-user-agent",
      subject: "Pontos não creditados após revisão",
      message:
        "Realizei a revisão de 30.000 km e gostaria de confirmar o crédito dos pontos no programa.",
      category: SupportTicketCategory.OTHER,
      priority: SupportTicketPriority.LOW,
      status: SupportTicketStatus.CLOSED,
      resolution:
        "Pontos creditados automaticamente na conclusão da ordem de serviço.",
      createdAt: daysAgo(33, 10),
      resolvedAt: daysAgo(32, 12),
    },
  ];
  for (const ticket of tickets)
    await prisma.supportTicket.upsert({
      where: { id: ticket.id },
      update: { status: ticket.status, resolution: ticket.resolution },
      create: {
        id: ticket.id,
        requesterId: ticket.requesterId,
        dealershipId: ticket.dealership
          ? dealerships[ticket.dealership].id
          : null,
        assignedToId: ticket.assignedToId,
        subject: ticket.subject,
        message: ticket.message,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        resolution: ticket.resolution,
        createdAt: ticket.createdAt,
        resolvedAt: "resolvedAt" in ticket ? (ticket.resolvedAt as Date) : null,
      },
    });

  const notifications = [
    {
      id: "seed-notification-recall-carlos",
      userId: "seed-user-carlos",
      type: NotificationType.RECALL,
      title: "Recall FORD-26-AX7",
      message:
        "Seu Territory possui uma inspeção preventiva gratuita disponível na rede autorizada.",
      link: "/seguranca",
      createdAt: daysAgo(20, 13),
      readAt: null,
    },
    {
      id: "seed-notification-service-carlos",
      userId: "seed-user-carlos",
      type: NotificationType.SERVICE,
      title: "Revisão em andamento",
      message: "A ordem de serviço do seu Territory está em atendimento.",
      link: "/agendamentos",
      createdAt: daysAgo(1, 8),
      readAt: null,
    },
    {
      id: "seed-notification-loyalty-carlos",
      userId: "seed-user-carlos",
      type: NotificationType.LOYALTY,
      title: "1.800 pontos creditados",
      message:
        "Os 1.800 pontos da revisão de 30.000 km já estão disponíveis para resgate.",
      link: "/fidelidade",
      createdAt: daysAgo(34, 16),
      readAt: daysAgo(33, 9),
    },
    {
      id: "seed-notification-campaign-fernanda",
      userId: "seed-user-fernanda",
      type: NotificationType.CAMPAIGN,
      title: "Check-up Ranger 5+",
      message:
        "Condição especial de revisão disponível para o seu Ranger até o fim do mês.",
      link: "/campanhas",
      createdAt: daysAgo(30, 10),
      readAt: null,
    },
    {
      id: "seed-notification-campaign-carlos",
      userId: "seed-user-carlos",
      type: NotificationType.CAMPAIGN,
      title: "Uma oferta para seu Territory",
      message:
        "Aproveite 10% de desconto na higienização do ar-condicionado junto ao próximo serviço.",
      link: "/ofertas",
      createdAt: daysAgo(4, 10),
      readAt: null,
    },
    {
      id: "seed-notification-team-sp",
      dealershipId: dealerships.sp.id,
      type: NotificationType.SYSTEM,
      title: "6 agendamentos para esta semana",
      message:
        "A agenda da unidade está com ocupação acima da média. Revise a capacidade da oficina.",
      link: "/agendamentos",
      createdAt: daysAgo(1, 7),
      readAt: null,
    },
  ];
  for (const notification of notifications)
    await prisma.notification.upsert({
      where: { id: notification.id },
      // A seed é reaplicável: texto, link e datas também voltam ao estado
      // coerente após uma demonstração ou após ajustes na história apresentada.
      update: {
        userId: "userId" in notification ? notification.userId : null,
        dealershipId:
          "dealershipId" in notification ? notification.dealershipId : null,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
      },
      create: notification,
    });

  const consents = [
    { userId: "seed-user-carlos", purpose: ConsentPurpose.MARKETING, granted: true, daysAgo: 120 },
    { userId: "seed-user-carlos", purpose: ConsentPurpose.ANALYTICS, granted: true, daysAgo: 120 },
    { userId: "seed-user-carlos", purpose: ConsentPurpose.PERSONALIZATION, granted: true, daysAgo: 60 },
    { userId: "seed-user-fernanda", purpose: ConsentPurpose.MARKETING, granted: true, daysAgo: 200 },
    { userId: "seed-user-eduardo", purpose: ConsentPurpose.MARKETING, granted: false, daysAgo: 300 },
  ];
  for (const consent of consents)
    await prisma.userConsent.upsert({
      where: {
        userId_purpose: { userId: consent.userId, purpose: consent.purpose },
      },
      update: { granted: consent.granted },
      create: {
        userId: consent.userId,
        purpose: consent.purpose,
        granted: consent.granted,
        source: "MOBILE",
        grantedAt: consent.granted ? daysAgo(consent.daysAgo) : null,
        revokedAt: consent.granted ? null : daysAgo(consent.daysAgo),
      },
    });

  await prisma.dataSubjectRequest.upsert({
    where: { id: "seed-data-request-carlos" },
    update: {},
    create: {
      id: "seed-data-request-carlos",
      requestedById: "seed-user-carlos",
      handledById: "seed-user-admin",
      type: DataRequestType.ACCESS,
      status: DataRequestStatus.COMPLETED,
      notes: "Solicitação de cópia dos dados pessoais tratados na plataforma.",
      resolution:
        "Cópia dos dados entregue ao titular em até 48 horas, conforme política LGPD.",
      createdAt: daysAgo(11, 9),
      completedAt: daysAgo(9, 15),
    },
  });

  // Ficha técnica ilustrativa dos conceitos autorais — não representa modelos Ford reais.
  const catalog = [
    {
      slug: "atlas",
      name: "Atlas",
      modelCode: "ATL-01",
      modelYear: 2026,
      version: "Work",
      category: "Picape de trabalho",
      summary: "Força, organização e autonomia para o dia a dia.",
      description: "Um utilitário autoral pensado para quem precisa transformar trabalho pesado em uma jornada mais simples.",
      highlights: "Carga inteligente · 4x4 · Cabine dupla",
      engine: "2.0 turbo",
      fuelType: "Flex",
      transmission: "Automática 8 marchas",
      drive: "4x4",
      power: "240 cv",
      torque: "380 Nm",
      consumption: "9,8 km/l",
      rangeLabel: "Autonomia estimada 720 km",
      dimensions: "5,30 m × 1,95 m × 1,85 m",
      seats: 5,
      warrantyLabel: "3 anos",
      stockLabel: "Sob encomenda",
      priceLabel: "Sob consulta",
      sortOrder: 1,
    },
    {
      slug: "pulse",
      name: "Pulse",
      modelCode: "PLS-01",
      modelYear: 2026,
      version: "Urban",
      category: "Picape urbana",
      summary: "Versatilidade compacta para a cidade e o fim de semana.",
      description: "Uma picape conceitual para acompanhar rotinas dinâmicas, com soluções flexíveis para carga e lazer.",
      highlights: "Eficiente · Flexível · Caçamba modular",
      engine: "1.5 turbo híbrido",
      fuelType: "Híbrido",
      transmission: "Automática CVT",
      drive: "4x2",
      power: "180 cv",
      torque: "270 Nm",
      consumption: "12,5 km/l",
      rangeLabel: "Autonomia estimada 850 km",
      dimensions: "5,05 m × 1,85 m × 1,75 m",
      seats: 5,
      warrantyLabel: "3 anos",
      stockLabel: "Disponível sob consulta",
      priceLabel: "Sob consulta",
      sortOrder: 2,
    },
    {
      slug: "horizon",
      name: "Horizon",
      modelCode: "HRZ-01",
      modelYear: 2026,
      version: "Family",
      category: "SUV conectado",
      summary: "Espaço, conforto e tecnologia para toda a família.",
      description: "Um SUV autoral que aproxima as pessoas da manutenção, da segurança e das experiências do veículo.",
      highlights: "Conectado · Assistências · 5 lugares",
      engine: "1.5 turbo",
      fuelType: "Flex",
      transmission: "Automática 7 marchas",
      drive: "4x2",
      power: "175 cv",
      torque: "280 Nm",
      consumption: "11,2 km/l",
      rangeLabel: "Autonomia estimada 780 km",
      dimensions: "4,70 m × 1,90 m × 1,70 m",
      seats: 5,
      warrantyLabel: "3 anos",
      stockLabel: "Disponível sob consulta",
      priceLabel: "Sob consulta",
      sortOrder: 3,
    },
    {
      slug: "trail",
      name: "Trail",
      modelCode: "TRL-01",
      modelYear: 2026,
      version: "Adventure",
      category: "SUV aventureiro",
      summary: "Confiança e personalidade para sair do roteiro.",
      description: "Um conceito aventureiro criado para representar liberdade, proteção e novas descobertas.",
      highlights: "Tração integral · Proteção · Aventura",
      engine: "2.0 turbo",
      fuelType: "Flex",
      transmission: "Automática 8 marchas",
      drive: "4x4",
      power: "220 cv",
      torque: "360 Nm",
      consumption: "9,4 km/l",
      rangeLabel: "Autonomia estimada 700 km",
      dimensions: "4,55 m × 1,90 m × 1,75 m",
      seats: 5,
      warrantyLabel: "3 anos",
      stockLabel: "Pré-lançamento",
      priceLabel: "Sob consulta",
      sortOrder: 4,
    },
  ];
  for (const item of catalog) {
    const model = await prisma.vehicleModel.upsert({
      where: { name_modelYear: { name: item.name, modelYear: item.modelYear } },
      update: {
        name: item.name,
        modelCode: item.modelCode,
        modelYear: item.modelYear,
        category: item.category,
        summary: item.summary,
        description: item.description,
        dimensions: item.dimensions,
        seats: item.seats,
        doors: 4,
        warrantyLabel: item.warrantyLabel,
        published: true,
      },
      create: {
        id: `seed-model-${item.slug}`,
        slug: `model-${item.slug}`,
        name: item.name,
        modelCode: item.modelCode,
        modelYear: item.modelYear,
        category: item.category,
        summary: item.summary,
        description: item.description,
        dimensions: item.dimensions,
        seats: item.seats,
        doors: 4,
        warrantyLabel: item.warrantyLabel,
        basePrice: 0,
        published: true,
      },
    });
    await prisma.catalogItem.upsert({
      where: { slug: item.slug },
      update: { ...item, modelId: model.id, exteriorColor: "Branco Ártico", interiorColor: "Preto", exteriorColors: ["Branco Ártico"], interiorColors: ["Preto"], published: true },
      create: { id: `seed-catalog-${item.slug}`, ...item, modelId: model.id, exteriorColor: "Branco Ártico", interiorColor: "Preto", exteriorColors: ["Branco Ártico"], interiorColors: ["Preto"], ctaLabel: "Tenho interesse", published: true },
    });
  }

  const [vehicles, customers, services] = await Promise.all([
    prisma.vehicle.count(),
    prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
    prisma.serviceOrder.count(),
  ]);
  console.log(
    [
      `Base de demonstração pronta: 3 concessionárias, ${customers} clientes,`,
      `${vehicles} veículos e ${services} ordens de serviço.`,
      removedUsers ? `Removidos ${removedUsers} usuários de teste.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

main().finally(() => prisma.$disconnect());
