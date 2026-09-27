import { MessageTemplateKey, UserRole } from "@prisma/client";

export type TemplateContent = {
  subject?: string;
  text: string;
  html?: string;
};

export type TeamInvitationPayload = {
  fullName: string;
  role: UserRole;
  dealershipName: string | null;
  link: string;
  expiresAt: string;
};

export type PasswordResetPayload = {
  fullName: string;
  link: string;
  expiresAt: string;
};

export type CustomerActivationPayload = PasswordResetPayload & {
  vehicleLabel?: string;
  /** Cadastro iniciado pelo proprietário: o veículo ainda aguarda conferência. */
  pendingVehicleLabel?: string;
};

export type VehicleApprovedPayload = {
  fullName: string;
  vehicleLabel: string;
  dealershipName?: string | null;
  appUrl: string;
  activationLink?: string | null;
  activationExpiresAt?: string | null;
};

/** Confirmação do autocadastro: a conta só é liberada após a conferência humana. */
export type VehicleRegistrationReceivedPayload = {
  fullName: string;
  vehicleLabel: string;
  dealershipName?: string | null;
};

export type VehicleRejectedPayload = {
  fullName: string;
  vehicleLabel: string;
  dealershipName?: string | null;
  reason: string;
  appUrl: string;
};

export type CampaignOfferPayload = {
  fullName: string;
  campaignTitle: string;
  description: string;
  model: string;
  ctaLabel: string;
  ctaLink: string;
  expiresAt: string;
};

export type EmailTestPayload = {
  fullName: string;
  appUrl: string;
  sentAt: string;
};

export type TemplatePayloads = {
  TEAM_INVITATION: TeamInvitationPayload;
  CUSTOMER_ACTIVATION: CustomerActivationPayload;
  VEHICLE_APPROVED: VehicleApprovedPayload;
  VEHICLE_REGISTRATION_RECEIVED: VehicleRegistrationReceivedPayload;
  VEHICLE_REJECTED: VehicleRejectedPayload;
  PASSWORD_RESET: PasswordResetPayload;
  CAMPAIGN_OFFER: CampaignOfferPayload;
  EMAIL_TEST: EmailTestPayload;
};

const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: "Proprietário",
  DEALERSHIP_AGENT: "Consultor",
  DEALERSHIP_MANAGER: "Gerente",
  FORD_ADMIN: "Administrador Ford",
};

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function safeLink(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return escapeHtml(trimmed);
  return "#";
}

function emailLayout(preheader: string, body: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ford Vínculo 360</title></head><body style="margin:0;padding:0;background:#edf2f8;font-family:Arial,Helvetica,sans-serif;color:#172b4d"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#edf2f8;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 34px rgba(12,39,86,.12)"><tr><td style="background:#062a78;padding:24px 34px 22px;color:#ffffff"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td><span style="display:inline-block;border:2px solid #ffffff;border-radius:999px;padding:4px 13px;font-family:Georgia,serif;font-size:18px;font-style:italic;font-weight:700;letter-spacing:-.5px;line-height:1">Ford</span><span style="display:inline-block;margin-left:11px;color:#9ed2ff;font-size:11px;font-weight:700;letter-spacing:1.4px;vertical-align:middle">VÍNCULO 360</span></td><td align="right" style="color:#c4ddff;font-size:11px;font-weight:700;letter-spacing:.8px">REDE CONECTADA</td></tr></table><div style="height:1px;background:#2c65ad;margin:20px 0 12px"></div><div style="color:#dbeaff;font-size:13px;line-height:1.5">Cuidado inteligente para acompanhar cada quilômetro.</div></td></tr><tr><td style="padding:34px">${body}</td></tr><tr><td style="padding:22px 34px;background:#f7f9fc;border-top:1px solid #e1e8f1"><p style="margin:0 0 7px;color:#244a7e;font-size:12px;font-weight:700">FORD VÍNCULO 360</p><p style="margin:0;color:#687991;font-size:12px;line-height:1.55">Mensagem automática da Rede Ford. Se você não reconhecer esta comunicação, pode ignorá-la com segurança.</p></td></tr></table><p style="margin:16px 0 0;color:#8a98aa;font-size:11px;line-height:1.45">Este e-mail foi enviado para você por uma comunicação relacionada ao seu veículo Ford.</p></td></tr></table></body></html>`;
}

const renderers: {
  [K in MessageTemplateKey]: (payload: TemplatePayloads[K]) => TemplateContent;
} = {
  TEAM_INVITATION: (payload) => {
    const role = ROLE_LABELS[payload.role];
    const org = payload.dealershipName ?? "Ford Vínculo 360";
    const deadline = formatDeadline(payload.expiresAt);
    return {
      subject: "Convite para a equipe Ford Vínculo 360",
      text: [`Olá, ${payload.fullName}.`, `Você foi convidado como ${role} em ${org}.`, `Ative seu acesso em: ${payload.link}`, `Este convite expira em ${deadline}.`].join("\n"),
      html: emailLayout("Seu convite para acessar o Ford Vínculo 360", `<h1 style="margin:0 0 16px;font-size:24px">Bem-vindo à equipe</h1><p>Olá, ${escapeHtml(payload.fullName)}.</p><p>Você foi convidado como <b>${escapeHtml(role)}</b> em <b>${escapeHtml(org)}</b>.</p><p style="margin:28px 0"><a href="${safeLink(payload.link)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#1368e8;color:#fff;text-decoration:none;font-weight:700">Ativar meu acesso</a></p><p style="color:#6b7895">Este convite expira em ${escapeHtml(deadline)}.</p>`),
    };
  },
  CUSTOMER_ACTIVATION: (payload) => {
    const deadline = formatDeadline(payload.expiresAt);
    if (payload.pendingVehicleLabel) {
      return {
        subject: "Recebemos seu veículo — Ford App",
        text: [
          `Olá, ${payload.fullName}.`,
          `Recebemos os dados do seu ${payload.pendingVehicleLabel}.`,
          "Crie sua senha para acompanhar a validação do vínculo pela Rede Ford.",
          `Criar senha: ${payload.link}`,
          `Este link expira em ${deadline}.`,
        ].join("\n"),
        html: emailLayout("Recebemos os dados do seu Ford", `<p style="margin:0 0 14px;color:#1865b5;font-size:11px;font-weight:700;letter-spacing:1.35px">CADASTRO EM VALIDAÇÃO</p><h1 style="margin:0 0 18px;color:#122957;font-size:29px;line-height:1.2;letter-spacing:-.45px">Seu Ford está a caminho da garagem.</h1><p style="margin:0 0 22px;color:#435775;font-size:16px;line-height:1.65">Olá, ${escapeHtml(payload.fullName)}. Recebemos os dados do seu veículo e a Rede Ford irá conferir o vínculo antes de liberá-lo no Ford App.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;background:#eef6ff;border:1px solid #d4e6fa;border-radius:14px"><tr><td style="padding:18px 20px"><p style="margin:0 0 5px;color:#4372a5;font-size:10px;font-weight:700;letter-spacing:1.2px">VEÍCULO INFORMADO</p><p style="margin:0;color:#123a70;font-size:21px;font-weight:700;line-height:1.25">${escapeHtml(payload.pendingVehicleLabel)}</p><p style="margin:8px 0 0;color:#526f93;font-size:13px;line-height:1.5">Você será avisado assim que a conferência for concluída.</p></td></tr></table><p style="margin:0;color:#243d61;font-size:15px;line-height:1.7">Enquanto isso, crie a senha exclusiva da sua conta. Ela dá acesso apenas ao Ford App — nunca ao painel administrativo da rede.</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 23px"><tr><td style="border-radius:9px;background:#1269df"><a href="${safeLink(payload.link)}" style="display:inline-block;padding:15px 24px;border-radius:9px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Criar minha senha&nbsp;&nbsp;→</a></td></tr></table><p style="margin:0;color:#7e8da2;font-size:12px;line-height:1.5">Por segurança, este link expira em ${escapeHtml(deadline)}.</p>`),
      };
    }
    const vehicle = payload.vehicleLabel
      ? ` O veículo ${payload.vehicleLabel} já está vinculado ao seu perfil.`
      : "";
    return {
      subject: "Ative sua conta — Ford Vínculo 360",
      text: [`Olá, ${payload.fullName}.`, `Seu cadastro foi realizado com sucesso.${vehicle}`, `Crie sua senha em: ${payload.link}`, `Este link expira em ${deadline}.`].join("\n"),
      html: emailLayout("Crie sua senha para acessar seu Ford", `<h1 style="margin:0 0 16px;font-size:24px">Seu Ford já está conectado</h1><p>Olá, ${escapeHtml(payload.fullName)}.</p><p>Seu cadastro foi realizado com sucesso.${escapeHtml(vehicle)}</p><p style="margin:28px 0"><a href="${safeLink(payload.link)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#1368e8;color:#fff;text-decoration:none;font-weight:700">Criar minha senha</a></p><p style="color:#6b7895">Este link expira em ${escapeHtml(deadline)}.</p>`),
    };
  },
  VEHICLE_APPROVED: (payload) => {
    const dealership = payload.dealershipName?.trim() || "Rede Ford";
    const activationLink = payload.activationLink?.trim() || null;
    const destination = activationLink ?? payload.appUrl;
    const ctaLabel = activationLink
      ? "Criar senha e abrir Ford App"
      : "Abrir Ford App";
    const accessInstruction = activationLink
      ? "Agora crie sua senha exclusiva para entrar no Ford App."
      : "Entre no Ford App com a senha que você criou.";
    const deadline = payload.activationExpiresAt
      ? formatDeadline(payload.activationExpiresAt)
      : null;
    return {
      subject: "Seu veículo foi aprovado — Ford App",
      text: [
        `Olá, ${payload.fullName}.`,
        `A ${dealership} concluiu a conferência do seu ${payload.vehicleLabel}.`,
        "O vínculo foi aprovado e o veículo já está disponível na sua garagem do Ford App.",
        accessInstruction,
        `${ctaLabel}: ${destination}`,
        ...(deadline ? [`Este link seguro expira em ${deadline}.`] : []),
      ].join("\n"),
      html: emailLayout(
        `Seu ${payload.vehicleLabel} foi aprovado e já está disponível no Ford App`,
        `<p style="margin:0 0 14px;color:#1f7a50;font-size:11px;font-weight:700;letter-spacing:1.35px">VÍNCULO APROVADO</p><h1 style="margin:0 0 18px;color:#122957;font-size:29px;line-height:1.2;letter-spacing:-.45px">Seu Ford já está na garagem.</h1><p style="margin:0 0 22px;color:#435775;font-size:16px;line-height:1.65">Olá, ${escapeHtml(payload.fullName)}. A ${escapeHtml(dealership)} concluiu a conferência dos dados e confirmou o vínculo do seu veículo.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;background:#edf9f2;border:1px solid #ccebd9;border-radius:14px"><tr><td style="padding:18px 20px"><p style="margin:0 0 5px;color:#39775a;font-size:10px;font-weight:700;letter-spacing:1.2px">VEÍCULO VALIDADO</p><p style="margin:0;color:#174c34;font-size:21px;font-weight:700;line-height:1.25">${escapeHtml(payload.vehicleLabel)}</p><p style="margin:8px 0 0;color:#4c735f;font-size:13px;line-height:1.5">A garagem, o acompanhamento de revisões e os serviços conectados já estão liberados.</p></td></tr></table><p style="margin:0;color:#243d61;font-size:15px;line-height:1.7">${escapeHtml(accessInstruction)} Esta conta é exclusiva para a experiência do proprietário e não permite acesso ao painel administrativo.</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 23px"><tr><td style="border-radius:9px;background:#1269df"><a href="${safeLink(destination)}" style="display:inline-block;padding:15px 24px;border-radius:9px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(ctaLabel)}&nbsp;&nbsp;→</a></td></tr></table>${deadline ? `<p style="margin:-10px 0 20px;color:#7e8da2;font-size:12px;line-height:1.5">Por segurança, o link para criar sua senha expira em ${escapeHtml(deadline)}.</p>` : ""}<p style="margin:0;color:#7e8da2;font-size:12px;line-height:1.5">A aprovação foi realizada por uma pessoa autorizada da Rede Ford e ficou registrada para auditoria.</p>`,
      ),
    };
  },
  VEHICLE_REGISTRATION_RECEIVED: (payload) => {
    const dealership = payload.dealershipName?.trim() || "Rede Ford";
    return {
      subject: "Recebemos seu cadastro — Ford App",
      text: [
        `Olá, ${payload.fullName}.`,
        `Recebemos o cadastro do seu ${payload.vehicleLabel}.`,
        `A ${dealership} vai conferir os dados e a posse do veículo antes de liberar sua conta.`,
        "Assim que a análise for concluída, você receberá outro e-mail. Se aprovado, ele trará o link para criar sua senha e entrar no Ford App.",
        "Não é preciso fazer mais nada por enquanto.",
      ].join("\n"),
      html: emailLayout(
        "Seu cadastro está em análise pela Rede Ford",
        `<p style="margin:0 0 14px;color:#b7791f;font-size:11px;font-weight:700;letter-spacing:1.35px">CADASTRO EM ANÁLISE</p><h1 style="margin:0 0 18px;color:#122957;font-size:29px;line-height:1.2;letter-spacing:-.45px">Recebemos seu cadastro.</h1><p style="margin:0 0 22px;color:#435775;font-size:16px;line-height:1.65">Olá, ${escapeHtml(payload.fullName)}. Para proteger você e o histórico do veículo, a ${escapeHtml(dealership)} vai conferir os dados e a posse antes de liberar sua conta.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;background:#fff8eb;border:1px solid #f3dfb8;border-radius:14px"><tr><td style="padding:18px 20px"><p style="margin:0 0 5px;color:#9a6a1c;font-size:10px;font-weight:700;letter-spacing:1.2px">VEÍCULO INFORMADO</p><p style="margin:0;color:#5c3f0e;font-size:21px;font-weight:700;line-height:1.25">${escapeHtml(payload.vehicleLabel)}</p><p style="margin:8px 0 0;color:#7d6334;font-size:13px;line-height:1.5">Status: aguardando aprovação</p></td></tr></table><p style="margin:0 0 12px;color:#243d61;font-size:15px;line-height:1.7"><b>Próximos passos</b></p><p style="margin:0;color:#243d61;font-size:15px;line-height:1.7">Assim que a análise for concluída, você receberá outro e-mail. Se aprovado, ele trará o link para criar sua senha e entrar no Ford App. Não é preciso fazer mais nada por enquanto.</p><p style="margin:24px 0 0;color:#7e8da2;font-size:12px;line-height:1.5">Se não foi você quem fez este cadastro, ignore esta mensagem: nenhuma conta é liberada sem a conferência da Rede Ford.</p>`,
      ),
    };
  },
  VEHICLE_REJECTED: (payload) => {
    const dealership = payload.dealershipName?.trim() || "Rede Ford";
    return {
      subject: "Não foi possível aprovar seu cadastro — Ford App",
      text: [
        `Olá, ${payload.fullName}.`,
        `A ${dealership} analisou o cadastro do seu ${payload.vehicleLabel} e não conseguiu confirmar os dados neste momento.`,
        `Motivo informado: ${payload.reason}`,
        `Você pode corrigir as informações e enviar um novo cadastro pelo Ford App (${payload.appUrl}) ou procurar uma concessionária Ford com o documento do veículo.`,
      ].join("\n"),
      html: emailLayout(
        "Atualização sobre o cadastro do seu veículo",
        `<p style="margin:0 0 14px;color:#b42318;font-size:11px;font-weight:700;letter-spacing:1.35px">CADASTRO NÃO APROVADO</p><h1 style="margin:0 0 18px;color:#122957;font-size:29px;line-height:1.2;letter-spacing:-.45px">Precisamos de uma correção.</h1><p style="margin:0 0 22px;color:#435775;font-size:16px;line-height:1.65">Olá, ${escapeHtml(payload.fullName)}. A ${escapeHtml(dealership)} analisou o cadastro do seu veículo e não conseguiu confirmar os dados neste momento.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;background:#fdf1f0;border:1px solid #f4d3cf;border-radius:14px"><tr><td style="padding:18px 20px"><p style="margin:0 0 5px;color:#a2463c;font-size:10px;font-weight:700;letter-spacing:1.2px">VEÍCULO INFORMADO</p><p style="margin:0;color:#5e1d15;font-size:19px;font-weight:700;line-height:1.25">${escapeHtml(payload.vehicleLabel)}</p><p style="margin:12px 0 4px;color:#a2463c;font-size:10px;font-weight:700;letter-spacing:1.2px">MOTIVO</p><p style="margin:0;color:#5e3a35;font-size:14px;line-height:1.6">${escapeHtml(payload.reason)}</p></td></tr></table><p style="margin:0;color:#243d61;font-size:15px;line-height:1.7">Você pode corrigir as informações e enviar um novo cadastro pelo Ford App, ou procurar uma concessionária Ford levando o documento do veículo.</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 10px"><tr><td style="border-radius:9px;background:#1269df"><a href="${safeLink(payload.appUrl)}" style="display:inline-block;padding:15px 24px;border-radius:9px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Enviar novo cadastro&nbsp;&nbsp;→</a></td></tr></table>`,
      ),
    };
  },
  PASSWORD_RESET: (payload) => {
    const deadline = formatDeadline(payload.expiresAt);
    return {
      subject: "Recuperação de senha - Ford Vínculo 360",
      text: [`Olá, ${payload.fullName}.`, "Recebemos uma solicitação para redefinir sua senha.", `Continue em: ${payload.link}`, `Este link expira em ${deadline}. Se você não solicitou, ignore esta mensagem.`].join("\n"),
      html: emailLayout("Link seguro para redefinir sua senha", `<h1 style="margin:0 0 16px;font-size:24px">Redefinição de senha</h1><p>Olá, ${escapeHtml(payload.fullName)}.</p><p>Recebemos uma solicitação para redefinir sua senha.</p><p style="margin:28px 0"><a href="${safeLink(payload.link)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#1368e8;color:#fff;text-decoration:none;font-weight:700">Definir nova senha</a></p><p style="color:#6b7895">Este link expira em ${escapeHtml(deadline)}. Se você não solicitou a troca, ignore esta mensagem.</p>`),
    };
  },
  CAMPAIGN_OFFER: (payload) => {
    const deadline = formatDeadline(payload.expiresAt);
    const vehicle = payload.model?.trim() || "veículo Ford";
    const ctaLabel = payload.ctaLabel?.trim() || "Abrir Ford App";
    return {
      subject: `${payload.campaignTitle} — Ford Vínculo 360`,
      text: [`Olá, ${payload.fullName}.`, `Seu veículo: ${vehicle}.`, payload.description, `${ctaLabel}: ${payload.ctaLink}`, `Mensagem disponível até ${deadline}.`].join("\n"),
      html: emailLayout(`Cuidado Ford para o seu ${vehicle}`, `<p style="margin:0 0 14px;color:#1865b5;font-size:11px;font-weight:700;letter-spacing:1.35px">ACOMPANHAMENTO PREVENTIVO</p><h1 style="margin:0 0 18px;color:#122957;font-size:29px;line-height:1.2;letter-spacing:-.45px">${escapeHtml(payload.campaignTitle)}</h1><p style="margin:0 0 24px;color:#435775;font-size:16px;line-height:1.65">Olá, ${escapeHtml(payload.fullName)}. Estamos acompanhando o ciclo do seu veículo para que você possa cuidar dele no melhor momento.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 25px;background:#eef6ff;border:1px solid #d4e6fa;border-radius:14px"><tr><td style="padding:18px 20px"><p style="margin:0 0 5px;color:#4372a5;font-size:10px;font-weight:700;letter-spacing:1.2px">SEU FORD</p><p style="margin:0;color:#123a70;font-size:21px;font-weight:700;line-height:1.25">${escapeHtml(vehicle)}</p><p style="margin:7px 0 0;color:#526f93;font-size:13px;line-height:1.5">Uma atenção preventiva agora ajuda a manter sua jornada em dia.</p></td></tr></table><p style="margin:0;color:#243d61;font-size:15px;line-height:1.7">${escapeHtml(payload.description)}</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 25px"><tr><td style="border-radius:9px;background:#1269df"><a href="${safeLink(payload.ctaLink)}" style="display:inline-block;padding:15px 24px;border-radius:9px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(ctaLabel)}&nbsp;&nbsp;→</a></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e4eaf2"><tr><td style="padding-top:18px"><p style="margin:0;color:#516583;font-size:13px;line-height:1.65"><b style="color:#183e72">Precisa de ajuda?</b><br>Ao abrir o Ford App, você pode escrever diretamente para a equipe e planejar seu atendimento.</p><p style="margin:12px 0 0;color:#7e8da2;font-size:12px;line-height:1.5">Mensagem disponível até ${escapeHtml(deadline)}.</p></td></tr></table>`),
    };
  },
  EMAIL_TEST: (payload) => {
    const sentAt = formatDeadline(payload.sentAt);
    return {
      subject: "Teste de e-mail — Ford Vínculo 360",
      text: [`Olá, ${payload.fullName}.`, "Este é um teste do canal de e-mail transacional do Ford Vínculo 360.", `O envio foi solicitado em ${sentAt}.`, `Acesse a plataforma: ${payload.appUrl}`].join("\n"),
      html: emailLayout("Teste de e-mail transacional concluído", `<h1 style="margin:0 0 16px;font-size:24px">E-mail configurado com sucesso</h1><p>Olá, ${escapeHtml(payload.fullName)}.</p><p>Este teste confirma que o Ford Vínculo 360 conseguiu entregar uma mensagem ao servidor SMTP configurado.</p><div style="margin:24px 0;padding:16px;border:1px solid #dce5f5;border-radius:12px;background:#f8fbff"><b>Próximo passo</b><br><span style="color:#6b7895">Valide a chegada na caixa de entrada e confira também a pasta de spam.</span></div><p><a href="${safeLink(payload.appUrl)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#1368e8;color:#fff;text-decoration:none;font-weight:700">Abrir plataforma</a></p><p style="color:#6b7895;font-size:13px">Solicitado em ${escapeHtml(sentAt)}.</p>`),
    };
  },
};

export function renderTemplate<K extends MessageTemplateKey>(
  key: K,
  payload: TemplatePayloads[K],
): TemplateContent {
  return renderers[key](payload);
}
