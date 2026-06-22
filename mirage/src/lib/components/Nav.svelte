<script lang="ts">
  import { page } from '$app/stores';
  import { privacyStore } from '$lib/privacy/store.svelte';

  const links = [
    { href: '/', label: 'home' },
    { href: '/mirage', label: 'mirage' },
    { href: '/shredder', label: 'shredder' },
    { href: '/auditor', label: 'auditor' },
    { href: '/threat', label: 'threat' },
    { href: '/resume', label: 'resume' },
    { href: '/recruiter', label: 'recruiter' },
    { href: '/inspect', label: 'inspect' },
    { href: '/about', label: 'about' },
    { href: '/projects', label: 'projects' },
    { href: '/tech', label: 'tech' },
    { href: '/contact', label: 'contact' }
  ];
</script>

<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="brand" aria-label="Home">nporto<span class="dim">/</span>mirage</a>
    <div class="links">
      {#each links as link}
        <a
          href={link.href}
          class:active={$page.url.pathname === link.href}
          aria-current={$page.url.pathname === link.href ? 'page' : undefined}
        >
          {link.label}
        </a>
      {/each}
    </div>
    <button
      class="inspect-btn"
      onclick={() => privacyStore.toggleInspector()}
      aria-label="Open Inspect AI dashboard"
      title="Open Inspect AI dashboard"
    >
      inspect<span class="dot" class:on={privacyStore.installed}></span>
    </button>
  </div>
</nav>

<style>
  .nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(11, 14, 19, 0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .nav-inner {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0.6rem 1.2rem;
    flex-wrap: wrap;
  }
  .brand {
    font-family: var(--mono);
    font-weight: 700;
    font-size: 1rem;
    color: var(--accent);
    text-decoration: none;
    letter-spacing: -0.02em;
  }
  .dim {
    color: rgba(255, 255, 255, 0.3);
    margin: 0 0.15rem;
  }
  .links {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    flex: 1;
  }
  .links a {
    font-family: var(--mono);
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.55);
    text-decoration: none;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }
  .links a:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.05);
  }
  .links a.active {
    color: var(--accent);
    background: rgba(0, 255, 200, 0.08);
  }
  .inspect-btn {
    font-family: var(--mono);
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.55);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .inspect-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: inline-block;
  }
  .dot.on {
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent);
  }
</style>