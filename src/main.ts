import { createApp } from 'vue'
import App from './App.vue'

import "vuetify/styles";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

const app = createApp(App)

app.use(createVuetify({
    components,
    directives,
}))

app.mount('#app')