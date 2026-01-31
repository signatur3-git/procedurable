import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Procedurable',
  description: 'Decision-driven procedural authoring platform — target architecture reference',
  themeConfig: {
    nav: [
      { text: 'Overview', link: '/' },
      { text: 'Components', link: '/components/overview' },
      { text: 'Integration', link: '/integration' },
      { text: 'Agent Workflow', link: '/agent-workflow' },
      { text: 'Target State', link: '/target-state' },
    ],
    sidebar: [
      {
        text: 'Architecture',
        items: [
          { text: 'Platform Overview', link: '/' },
          { text: 'Design Principles', link: '/principles' },
          { text: 'System Flow', link: '/system-flow' },
        ]
      },
      {
        text: 'Components',
        items: [
          { text: 'Component Map', link: '/components/overview' },
          { text: 'Math & Spatial', link: '/components/math-spatial' },
          { text: 'Geometry', link: '/components/geometry' },
          { text: 'Text', link: '/components/text' },
          { text: 'Builder Engine', link: '/components/builder' },
          { text: 'Scene & Composition', link: '/components/scene' },
          { text: 'Materials & Modifiers', link: '/components/materials-modifiers' },
          { text: 'Validation & Quality', link: '/components/validation' },
          { text: 'Authoring Server', link: '/components/authoring' },
          { text: 'MCP Server', link: '/components/mcp' },
          { text: 'Storage', link: '/components/storage' },
          { text: 'Dashboard', link: '/components/dashboard' },
          { text: 'Export', link: '/components/export' },
        ]
      },
      {
        text: 'Integration',
        items: [
          { text: 'How Components Connect', link: '/integration' },
          { text: 'YAML Builder Format', link: '/yaml-format' },
          { text: 'Data Flow & Tracing', link: '/data-flow' },
        ]
      },
      {
        text: 'Agent Experience',
        items: [
          { text: 'Agent Workflow', link: '/agent-workflow' },
          { text: 'Knowledge System', link: '/knowledge' },
          { text: 'Quality Tiers', link: '/quality-tiers' },
        ]
      },
      {
        text: 'Target State',
        items: [
          { text: 'Where We\'re Headed', link: '/target-state' },
          { text: 'Gaps & Open Questions', link: '/gaps' },
        ]
      },
    ],
    outline: 'deep',
  }
})
