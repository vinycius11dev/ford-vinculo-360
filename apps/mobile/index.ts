import { registerRootComponent } from "expo";

import App from "./App";

// Entry point próprio: o padrão do Expo (`expo/AppEntry`) resolve o App por
// caminho relativo assumindo node_modules plano, o que não funciona com a
// estrutura isolada do pnpm.
registerRootComponent(App);
