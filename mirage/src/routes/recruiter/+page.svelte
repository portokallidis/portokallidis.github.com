<svelte:head>
  <title>Recruiter — Mirage</title>
  <meta name="description" content="Voice loop with Web Speech API + WebLLM. Real-time STT → LLM → TTS, all in the browser." />
</svelte:head>

<section class="hero">
  <h1>Voice Recruiter</h1>
  <p class="subtitle">
    Speak into your microphone. Web Speech API transcribes in real time. The transcript is sent
    to a local LLM (Hermes 3 8B via WebLLM) or the extractive fallback. The answer is spoken
    back. The loop runs entirely on-device after the model finishes loading.
  </p>
</section>

<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { webllm } from '$lib/ai/webllm-engine.svelte';
  import { answerFromContext } from '$lib/demos/resume/rag';

  type SpeechRecognitionAlternativeLike = { transcript: string; confidence: number };
  type SpeechRecognitionResultLike = { isFinal: boolean; 0: SpeechRecognitionAlternativeLike; length: number };
  type SpeechRecognitionResultListLike = { length: number; [index: number]: SpeechRecognitionResultLike };
  type SpeechRecognitionEventLike = { results: SpeechRecognitionResultListLike; resultIndex: number };
  type SpeechRecognitionErrorEventLike = { error: string; message?: string };
  type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((e: SpeechRecognitionEventLike) => void) | null;
    onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
    onend: (() => void) | null;
  };
  type SpeechRecognitionCtorLike = new () => SpeechRecognitionLike;

  let listening = $state(false);
  let speaking = $state(false);
  let statusText = $state('idle');
  let interim = $state('');
  let transcript = $state('');
  let answer = $state('');
  let useLLM = $state(false);
  let modelLoaded = $state(false);

  let recognition: SpeechRecognitionLike | null = null;

  onMount(() => {
    if (!browser) return;
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtorLike; webkitSpeechRecognition?: SpeechRecognitionCtorLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      statusText = 'Web Speech API not available in this browser';
      return;
    }
    recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        if (result.isFinal) {
          finalText += alt.transcript + ' ';
        } else {
          interimText += alt.transcript;
        }
      }
      if (finalText) {
        transcript += finalText;
        interim = '';
        ask(finalText.trim());
      } else {
        interim = interimText;
      }
    };
    recognition.onerror = (event) => {
      statusText = `recognition error: ${event.error}`;
      listening = false;
    };
    recognition.onend = () => {
      listening = false;
    };
  });

  onDestroy(() => {
    recognition?.abort();
    if (browser) window.speechSynthesis?.cancel();
  });

  async function loadModel() {
    if (modelLoaded) return;
    statusText = 'loading LLM…';
    try {
      await webllm.load();
      modelLoaded = true;
      useLLM = true;
      statusText = 'LLM ready';
    } catch (e) {
      statusText = `model load failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  function start() {
    if (!recognition) return;
    transcript = '';
    interim = '';
    answer = '';
    recognition.start();
    listening = true;
    statusText = 'listening…';
  }

  function stop() {
    recognition?.stop();
    listening = false;
    statusText = 'stopped';
  }

  async function ask(question: string) {
    if (!question) return;
    statusText = 'thinking…';
    let response: string;
    if (useLLM && modelLoaded) {
      try {
        response = await webllm.generate(
          [
            { role: 'system', content: 'You are Nick Portokallidis, a senior full-stack developer with DevOps and AI experience. Answer the recruiter\u2019s question briefly and concretely. Use first person.' },
            { role: 'user', content: question }
          ],
          { temperature: 0.6, maxTokens: 256 }
        );
      } catch (e) {
        response = `LLM error: ${e instanceof Error ? e.message : String(e)}\n\nFalling back to extractive answer:\n${answerFromContext(question)}`;
      }
    } else {
      response = answerFromContext(question);
    }
    answer = response;
    speak(response);
    statusText = 'idle';
  }

  function speak(text: string) {
    if (!browser) return;
    window.speechSynthesis?.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    utter.onstart = () => speaking = true;
    utter.onend = () => speaking = false;
    window.speechSynthesis?.speak(utter);
  }

  function stopSpeaking() {
    if (browser) window.speechSynthesis?.cancel();
    speaking = false;
  }
</script>

<div class="card">
  <div class="row gap-2" style="margin-bottom: 1rem; flex-wrap: wrap;">
    {#if !listening}
      <button class="primary" onclick={start}>start listening</button>
    {:else}
      <button class="ghost" onclick={stop}>stop listening</button>
    {/if}
    {#if speaking}
      <button class="ghost" onclick={stopSpeaking}>stop speaking</button>
    {/if}
    {#if !modelLoaded}
      <button class="ghost" onclick={loadModel}>load LLM (~5 GB)</button>
    {:else}
      <span class="badge accent">LLM ready</span>
    {/if}
    <span class="dim mono" style="margin-left: auto;">{statusText}</span>
  </div>

  <div class="grid" style="grid-template-columns: 1fr 1fr;">
    <div class="card">
      <h3>Transcript</h3>
      <p class="mono small" style="min-height: 6rem; white-space: pre-wrap;">{transcript}<span class="dim">{interim}</span></p>
    </div>
    <div class="card">
      <h3>Answer</h3>
      <p class="mono small" style="min-height: 6rem; white-space: pre-wrap;">{answer || (modelLoaded ? '' : 'Click "load LLM" for richer answers. Default uses token-overlap over my CV.')}</p>
    </div>
  </div>

  <p class="dim small" style="margin-top: 1rem;">
    Default mode uses <a href="/resume">extractive retrieval</a> over my CV (deterministic, instant).
    Loading the LLM (~5 GB download) unlocks richer answers with citation, but the model
    stays in your browser after that.
  </p>
</div>