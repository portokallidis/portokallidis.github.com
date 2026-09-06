import { contact } from '../content';

export default function Privacy() {
  return <>
    <header className="page-intro"><p className="eyebrow">Site information</p><h1>Privacy, plainly.</h1><p>A static portfolio with an optional conversation. Updated 6 September 2026.</p></header>
    <article className="prose legal-prose">
      <h2>Browsing the portfolio</h2>
      <p>This website uses no third-party analytics, tracking pixels, advertising, session recording, or application cookies.
        Cloudflare serves its static files and may process technical request information, including IP addresses, under its own hosting practices.</p>
      <h2>The optional conversation</h2>
      <p>Before you select Start, the conversation does not load its portfolio sources or initialize an AI model.
        Start loads public portfolio information and prepares a local model on a supported device.</p>
      <p>Questions and answers in this chat stay in the current tab’s memory.
        The application does not put them in URLs, browser storage, or an application query log.</p>
      <h2>On-device AI and model downloads</h2>
      <p>The conversation checks for a supported browser’s built-in model and generates answers on your device.
        If that is unavailable, the same interface searches public portfolio sources without a model.
        The portfolio has no hosted inference endpoint that receives your questions.</p>
      <p>Your browser manages its built-in model download and availability.
        This portfolio does not download model files from a third-party model host.</p>
      <p>Downloaded model files may be cached by your browser for later visits.
        These files are separate from chat messages.
        Browser and operating-system diagnostics follow your own settings and their providers’ practices.</p>
      <h2>Browser assistant access</h2>
      <p>On browsers that support WebMCP, compatible assistants can use read-only tools to access public portfolio information.
        Invoking a tool loads the public sources independently of the chat’s Start button and does not initialize a model.
        How an assistant handles that information depends on the browser and assistant you choose.</p>
      <h2>Contact</h2>
      <p>Email me links open your email application.
        Any email you send is handled by your email provider and the recipient’s provider.</p>
      <p>For a question about this site, <a href={`mailto:${contact.email}`}>email me</a>.</p>
      <h2>Professional material</h2>
      <p>The public site uses selected professional information.
        It does not provide a raw CV or publish residential addresses, birth dates, or telephone numbers in the new site build.
        This statement concerns the deployed portfolio, not historical copies of the previous website.</p>
    </article>
  </>;
}
