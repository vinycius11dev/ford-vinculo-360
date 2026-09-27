const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function capture() {
  console.log('Iniciando captura limpa e completa de todas as telas...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  // ==========================================
  // PARTE 1: APP MOBILE DO PROPRIETÁRIO (8081)
  // ==========================================
  const mobileContext = await browser.newContext({
    viewport: { width: 420, height: 900 },
    deviceScaleFactor: 2,
  });
  const m = await mobileContext.newPage();

  console.log('Carregando App Mobile em http://127.0.0.1:8081/ ...');
  await m.goto('http://127.0.0.1:8081/');
  await m.waitForTimeout(3000);

  // 01. Tela de Login
  console.log('01. Capturando Login Mobile...');
  await m.screenshot({ path: path.join(outDir, '01_mobile_login.png') });

  // 02. Tela de Auto-Cadastro de Proprietário e Veículo
  console.log('02. Capturando Auto-Cadastro...');
  try {
    const regBtn = m.getByText('Já tenho um Ford e ainda não tenho conta');
    if (await regBtn.isVisible()) {
      await regBtn.click();
      await m.waitForTimeout(1000);
      await m.screenshot({ path: path.join(outDir, '02_mobile_cadastro_proprietario.png') });
      await m.getByText('Voltar para o login').click();
      await m.waitForTimeout(800);
    }
  } catch (e) {
    console.warn('Auto-cadastro:', e.message);
  }

  // 03. Tela de Recuperação de Senha / Primeiro Acesso
  console.log('03. Capturando Recuperação de Senha...');
  try {
    const forgotBtn = m.getByText('Esqueci a senha').or(m.getByText('Primeiro Acesso'));
    if (await forgotBtn.isVisible()) {
      await forgotBtn.click();
      await m.waitForTimeout(1000);
      await m.screenshot({ path: path.join(outDir, '03_mobile_recuperacao_senha.png') });
      const backLogin = m.getByText('Voltar para o login');
      if (await backLogin.isVisible()) {
        await backLogin.click();
        await m.waitForTimeout(800);
      }
    }
  } catch (e) {
    console.warn('Recuperação senha:', e.message);
  }

  // Efetuar Login com demo carlos@ford360.local
  console.log('Efetuando login como Carlos (Territory Titanium)...');
  await m.getByText('Preencher demo: carlos@ford360.local').click();
  await m.waitForTimeout(500);
  await m.getByText('Entrar na minha conta', { exact: true }).click();
  await m.waitForTimeout(3500);

  // 04. Home / Meu Ford (Identidade Digital do VIN, Garantia, Odômetro)
  console.log('04. Capturando Home do Veículo (Identidade VIN)...');
  await m.screenshot({ path: path.join(outDir, '04_mobile_home_veiculo.png') });

  // 05. Home com Rolagem (Próxima Manutenção Programada e Ofertas)
  console.log('05. Capturando Home (Próxima Revisão & Ofertas)...');
  try {
    await m.evaluate(() => window.scrollBy(0, 480));
    await m.waitForTimeout(1000);
    await m.screenshot({ path: path.join(outDir, '05_mobile_home_manutencao.png') });
    await m.evaluate(() => window.scrollTo(0, 0));
    await m.waitForTimeout(500);
  } catch (e) {
    console.warn('Scroll home:', e.message);
  }

  // 06. Modal Minha Garagem (Gestão de Veículos e Bônus Troca)
  console.log('06. Capturando Minha Garagem...');
  try {
    const garageBtn = m.getByText(/MINHA GARAGEM/i).first();
    if (await garageBtn.isVisible()) {
      await garageBtn.click();
      await m.waitForTimeout(1200);
      await m.screenshot({ path: path.join(outDir, '06_mobile_minha_garagem.png') });

      // 07. Modal Vincular Veículo (Claim com VIN e Placa)
      console.log('07. Capturando Vincular Veículo (Claim)...');
      const addFordBtn = m.getByText('Adicionar outro Ford');
      if (await addFordBtn.isVisible()) {
        await addFordBtn.click();
        await m.waitForTimeout(1200);
        await m.screenshot({ path: path.join(outDir, '07_mobile_vincular_veiculo.png') });
        await m.keyboard.press('Escape');
        await m.waitForTimeout(800);
      } else {
        await m.keyboard.press('Escape');
      }
    }
  } catch (e) {
    console.warn('Garagem / Claim:', e.message);
  }

  // 08. Ficha Técnica Mecânica do Veículo & Garantia
  console.log('08. Capturando Ficha Técnica Completa...');
  try {
    const techBtn = m.getByText('Ver ficha mecânica completa');
    if (await techBtn.isVisible()) {
      await techBtn.click();
      await m.waitForTimeout(1200);
      await m.screenshot({ path: path.join(outDir, '08_mobile_detalhes_veiculo.png') });
      await m.keyboard.press('Escape');
      await m.waitForTimeout(800);
    }
  } catch (e) {
    console.warn('Ficha técnica:', e.message);
  }

  // 09. Aba Histórico Contínuo de Revisões e Serviços
  console.log('09. Capturando Aba Histórico de Serviços...');
  try {
    const tabHistory = m.getByRole('tab', { name: 'Histórico' });
    if (await tabHistory.isVisible()) {
      await tabHistory.click();
      await m.waitForTimeout(1500);
      await m.screenshot({ path: path.join(outDir, '09_mobile_historico_servicos.png') });

      // 10. Detalhes de Ordem de Serviço da Concessionária
      console.log('10. Capturando Detalhe da Ordem de Serviço...');
      const osItem = m.locator('text=/Revisão|diagnóstico|ordem|serviço/i').first();
      if (await osItem.isVisible()) {
        await osItem.click();
        await m.waitForTimeout(1000);
        await m.screenshot({ path: path.join(outDir, '10_mobile_detalhe_ordem_servico.png') });
        await m.keyboard.press('Escape');
        await m.waitForTimeout(600);
      }
    }
  } catch (e) {
    console.warn('Histórico / OS:', e.message);
  }

  // 11. Aba Programa Ford Pontos (Saldo & Extrato)
  console.log('11. Capturando Aba Ford Pontos...');
  try {
    const tabPoints = m.getByRole('tab', { name: 'Pontos' });
    if (await tabPoints.isVisible()) {
      await tabPoints.click();
      await m.waitForTimeout(1500);
      await m.screenshot({ path: path.join(outDir, '11_mobile_ford_pontos.png') });

      // 12. Catálogo de Vouchers de Desconto e Benefícios
      console.log('12. Capturando Vouchers e Benefícios...');
      await m.evaluate(() => window.scrollBy(0, 420));
      await m.waitForTimeout(1000);
      await m.screenshot({ path: path.join(outDir, '12_mobile_vouchers_beneficios.png') });
      await m.evaluate(() => window.scrollTo(0, 0));
    }
  } catch (e) {
    console.warn('Pontos / Vouchers:', e.message);
  }

  // 13. Aba Meus Agendamentos na Rede Ford
  console.log('13. Capturando Aba Agendamentos...');
  try {
    const tabBookings = m.getByRole('tab', { name: 'Agenda' });
    if (await tabBookings.isVisible()) {
      await tabBookings.click();
      await m.waitForTimeout(1500);
      await m.screenshot({ path: path.join(outDir, '13_mobile_agendamentos.png') });

      // 14. Modal Novo Agendamento na Concessionária
      console.log('14. Capturando Modal Novo Agendamento...');
      await m.getByRole('tab', { name: 'Início' }).click();
      await m.waitForTimeout(1000);
      const scheduleBtn = m.getByText('Agendar serviço').first();
      if (await scheduleBtn.isVisible()) {
        await scheduleBtn.click();
        await m.waitForTimeout(1400);
        await m.screenshot({ path: path.join(outDir, '14_mobile_novo_agendamento.png') });
        await m.keyboard.press('Escape');
        await m.waitForTimeout(800);
      }
    }
  } catch (e) {
    console.warn('Agendamentos:', e.message);
  }

  // 15. Aba Central de Alertas & Recalls
  console.log('15. Capturando Aba Alertas & Recalls...');
  try {
    const tabAlerts = m.getByRole('tab', { name: 'Avisos' });
    if (await tabAlerts.isVisible()) {
      await tabAlerts.click();
      await m.waitForTimeout(1500);
      await m.screenshot({ path: path.join(outDir, '15_mobile_alertas_recalls.png') });
    }
  } catch (e) {
    console.warn('Alertas:', e.message);
  }

  // 16. Menu da Conta do Proprietário & Suporte
  console.log('16. Capturando Menu Conta & Suporte...');
  try {
    await m.getByRole('tab', { name: 'Início' }).click();
    await m.waitForTimeout(800);
    const accountBtn = m.locator('[aria-label="Abrir minha conta"], [accessibilitylabel="Abrir minha conta"]').first();
    if (await accountBtn.isVisible()) {
      await accountBtn.click();
      await m.waitForTimeout(1200);
      await m.screenshot({ path: path.join(outDir, '16_mobile_menu_conta_suporte.png') });

      // 17. Privacidade e LGPD
      console.log('17. Capturando Privacidade & LGPD...');
      const lgpdRow = m.getByText('Privacidade e dados');
      if (await lgpdRow.isVisible()) {
        await lgpdRow.click();
        await m.waitForTimeout(1200);
        await m.screenshot({ path: path.join(outDir, '17_mobile_privacidade_lgpd.png') });
        await m.keyboard.press('Escape');
        await m.waitForTimeout(600);
      }
      await m.keyboard.press('Escape');
    }
  } catch (e) {
    console.warn('Conta / LGPD:', e.message);
  }

  // 18. Vitrine / Catálogo de Novos Modelos Ford
  console.log('18. Capturando Vitrine de Modelos Ford...');
  try {
    const garageBtn = m.getByText(/MINHA GARAGEM/i).first();
    if (await garageBtn.isVisible()) {
      await garageBtn.click();
      await m.waitForTimeout(1000);
      const viewNextBtn = m.getByText('Ver próximos Ford');
      if (await viewNextBtn.isVisible()) {
        await viewNextBtn.click();
        await m.waitForTimeout(1400);
        await m.screenshot({ path: path.join(outDir, '18_mobile_vitrine_modelos.png') });
        await m.keyboard.press('Escape');
        await m.waitForTimeout(600);
      }
    }
  } catch (e) {
    console.warn('Vitrine catálogo:', e.message);
  }

  await mobileContext.close();

  // ==========================================
  // PARTE 2: PAINEL WEB DA CONCESSIONÁRIA & FORD ADMIN (5173)
  // ==========================================
  console.log('\nIniciando capturas do Painel Web...');
  const webContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const p = await webContext.newPage();

  console.log('Navegando para o painel web em http://127.0.0.1:5173/ ...');
  await p.goto('http://127.0.0.1:5173/');
  await p.waitForTimeout(2000);

  // Login como Gerente SP
  try {
    const gerenteBtn = p.getByRole('button', { name: /Gerente/i }).or(p.getByText('Gerente (SP)'));
    if (await gerenteBtn.isVisible()) {
      await gerenteBtn.click();
      await p.waitForTimeout(500);
      await p.getByRole('button', { name: 'Entrar no Vínculo 360' }).click();
      await p.waitForTimeout(3000);
    }
  } catch (e) {
    console.warn('Login web Gerente:', e.message);
  }

  // 19. Painel Principal - Visão Geral & Retenção
  console.log('19. Capturando Painel Geral da Concessionária...');
  try {
    await p.screenshot({ path: path.join(outDir, '19_web_painel_visao_geral.png') });
  } catch (err) {
    console.warn('Visão geral web:', err.message);
  }

  // 20. Desafio 02 / Analytics & Risco de Evasão (Machine Learning)
  console.log('20. Capturando Desafio 02 & Risco de Evasão ML...');
  try {
    await p.goto('http://127.0.0.1:5173/desafio-02');
    await p.waitForTimeout(3000);
    await p.screenshot({ path: path.join(outDir, '20_web_risco_evasao_ml.png') });
  } catch (err) {
    console.warn('Risco evasão:', err.message);
  }

  // 21. Clientes & Ficha Cadastral com LGPD
  console.log('21. Capturando Lista de Clientes...');
  try {
    await p.goto('http://127.0.0.1:5173/clientes');
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(outDir, '21_web_gestao_clientes.png') });
  } catch (err) {
    console.warn('Clientes:', err.message);
  }

  // 22. Funil de Recompra de Usados
  console.log('22. Capturando Oportunidades de Recompra...');
  try {
    await p.goto('http://127.0.0.1:5173/recompra');
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(outDir, '22_web_funil_recompra.png') });
  } catch (err) {
    console.warn('Recompra:', err.message);
  }

  // 23. Campanhas e Jornadas Automatizadas
  console.log('23. Capturando Gestão de Campanhas...');
  try {
    await p.goto('http://127.0.0.1:5173/campanhas');
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(outDir, '23_web_gestao_campanhas.png') });
  } catch (err) {
    console.warn('Campanhas:', err.message);
  }

  // 24. Estoque de Veículos Novos e Seminovos
  console.log('24. Capturando Estoque & Vendas...');
  try {
    await p.goto('http://127.0.0.1:5173/estoque');
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(outDir, '24_web_estoque_vendas.png') });
  } catch (err) {
    console.warn('Estoque:', err.message);
  }

  // 25. Visão Nacional Ford Admin (VIN Share)
  console.log('25. Capturando Visão Ford Admin (VIN Share)...');
  try {
    await p.goto('http://127.0.0.1:5173/login');
    await p.waitForTimeout(1500);
    const adminBtn = p.getByRole('button', { name: /Admin HQ/i }).or(p.getByText('Administrador Ford'));
    if (await adminBtn.isVisible()) {
      await adminBtn.click();
      await p.waitForTimeout(500);
      await p.getByRole('button', { name: 'Entrar no Vínculo 360' }).click();
      await p.waitForTimeout(3000);
      await p.screenshot({ path: path.join(outDir, '25_web_admin_vin_share.png') });
    }
  } catch (err) {
    console.warn('Admin nacional:', err.message);
  }

  await webContext.close();
  await browser.close();

  console.log('\nCaptura concluída com sucesso! Imagens salvas em: ' + outDir);
}

capture().catch((err) => {
  console.error('Falha geral na captura:', err);
  process.exit(1);
});
