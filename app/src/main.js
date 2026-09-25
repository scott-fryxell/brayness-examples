import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Notes from './views/Notes.vue'
import Note from './views/Note.vue'

// Hash history: a static host needs no rewrite rules.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Notes },
    { path: '/notes/:created', component: Note, props: true }
  ]
})

createApp(App).use(router).mount('#app')
