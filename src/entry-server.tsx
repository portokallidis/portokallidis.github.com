import { prerenderToNodeStream } from 'react-dom/static';
import { StaticRouter } from 'react-router';
import App from './App';

export async function render(path: string) {
  const { prelude } = await prerenderToNodeStream(<StaticRouter location={path}><App /></StaticRouter>);
  let html = '';
  for await (const chunk of prelude) html += chunk.toString();
  return html;
}
