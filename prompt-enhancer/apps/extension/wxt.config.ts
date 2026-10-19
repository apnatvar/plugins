import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const websiteHosts = ['http://*/*', 'https://*/*'];

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  zip: { name: 'prompt-composer', zipSources: false },
  manifest: () => ({
    name: 'Prompt Composer',
    description: 'Prompt review, formatting and reusable snippets for compatible web editors.',
    version: '0.2.3',
    homepage_url: 'https://brownsmithdynamics.com',
    minimum_chrome_version: '116',
    permissions: ['storage', 'sidePanel'],
    host_permissions: websiteHosts,
    action: { default_title: 'Open Prompt Composer' },
    side_panel: { default_path: 'sidepanel.html' },
  }),
  vite: () => ({ plugins: [tailwindcss()] }),
});
