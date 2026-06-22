<script lang="ts">import { cv } from '$lib/content/cv';</script>
<svelte:head><title>Contact</title></svelte:head>
<section class="hero"><span class="badge accent">contact</span><h1>Private by default contact.</h1><p class="subtitle">No telemetry form. Use direct channels.</p></section>
<div class="card col gap-2"><p>Email: <a href={`mailto:${cv.email}`}>{cv.email}</a></p><p>Website: <a href={cv.website}>{cv.website}</a></p><p class="dim">Passkey contact can be layered in without adding third-party scripts.</p></div>
