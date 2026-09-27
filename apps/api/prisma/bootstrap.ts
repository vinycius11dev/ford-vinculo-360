import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const dealerships = [
  {
    id: "seed-dealer-center-norte",
    legalName: "Ford Center Norte Automóveis Ltda.",
    tradeName: "Ford Center Norte",
    cnpj: "12345678000190",
    city: "São Paulo",
    state: "SP",
    simultaneousCapacity: 4,
  },
  {
    id: "seed-dealer-slaviero",
    legalName: "Slaviero Veículos Ltda.",
    tradeName: "Ford Slaviero",
    cnpj: "98765432000110",
    city: "Curitiba",
    state: "PR",
    simultaneousCapacity: 3,
  },
  {
    id: "seed-dealer-minas",
    legalName: "Minas Motors Comércio de Veículos Ltda.",
    tradeName: "Ford Minas Motors",
    cnpj: "45678912000133",
    city: "Belo Horizonte",
    state: "MG",
    simultaneousCapacity: 3,
  },
];

const staff = [
  { id: "seed-user-admin", email: "admin@ford360.local", fullName: "Administrador Ford Brasil", phone: "1130030000", role: UserRole.FORD_ADMIN, dealershipId: null },
  { id: "seed-user-manager", email: "gerente@ford360.local", fullName: "André Martins", phone: "11991110001", role: UserRole.DEALERSHIP_MANAGER, dealershipId: "seed-dealer-center-norte" },
  { id: "seed-user-agent", email: "consultora@ford360.local", fullName: "Beatriz Santos", phone: "11993334455", role: UserRole.DEALERSHIP_AGENT, dealershipId: "seed-dealer-center-norte" },
  { id: "seed-user-agent-sp2", email: "consultor.sp@ford360.local", fullName: "Thiago Nogueira", phone: "11992220002", role: UserRole.DEALERSHIP_AGENT, dealershipId: "seed-dealer-center-norte" },
  { id: "seed-user-manager-pr", email: "gerente.pr@ford360.local", fullName: "Rafael Duarte", phone: "41994440004", role: UserRole.DEALERSHIP_MANAGER, dealershipId: "seed-dealer-slaviero" },
  { id: "seed-user-agent-pr", email: "consultora.pr@ford360.local", fullName: "Larissa Prado", phone: "41995550005", role: UserRole.DEALERSHIP_AGENT, dealershipId: "seed-dealer-slaviero" },
  { id: "seed-user-manager-mg", email: "gerente.mg@ford360.local", fullName: "Camila Rocha", phone: "31996660006", role: UserRole.DEALERSHIP_MANAGER, dealershipId: "seed-dealer-minas" },
];

async function main() {
  const passwordHash = await hash("Ford@360", 12);

  for (const dealership of dealerships) {
    await prisma.dealership.upsert({
      where: { cnpj: dealership.cnpj },
      update: dealership,
      create: dealership,
    });
  }

  for (const member of staff) {
    await prisma.user.upsert({
      where: { email: member.email },
      update: { ...member, passwordHash, active: true },
      create: { ...member, passwordHash },
    });
  }

  await prisma.programSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", minimumPoints: 100, mileagePerPoint: 100 },
  });

  console.log("Base vazia preparada: acessos internos e configurações preservados.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
