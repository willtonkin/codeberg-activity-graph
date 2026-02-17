'use client';

import { useEffect, useMemo, useState } from 'react';

const THEMES = ['codeberg', 'codeberg_light', 'github', 'github_light'];
const DEFAULT_BASE = 'https://your-deployment.vercel.app';

export default function Home() {
  const [username, setUsername] = useState('');
  const [submittedUser, setSubmittedUser] = useState('');
  const [theme, setTheme] = useState('codeberg');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewState, setPreviewState] = useState('idle');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
      const urlUser = new URLSearchParams(window.location.search).get('user');
      if (urlUser) {
        setUsername(urlUser);
        setSubmittedUser(urlUser.trim());
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (username) {
      url.searchParams.set('user', username);
    } else {
      url.searchParams.delete('user');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [username]);

  useEffect(() => {
    if (!submittedUser) return;
    setPreviewState('loading');
    setPreviewUrl(`/activity?user=${encodeURIComponent(submittedUser)}&theme=${theme}`);
  }, [submittedUser, theme]);

  const snippets = useMemo(() => {
    const user = submittedUser || 'USERNAME';
    const url = `${baseUrl}/activity?user=${encodeURIComponent(user)}&theme=${theme}`;
    return {
      markdown: `![Codeberg Activity](${url})`,
      html: `<img src="${url}" alt="${user}'s Codeberg Activity"/>`,
    };
  }, [baseUrl, submittedUser, theme]);

  const handleGenerate = () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setSubmittedUser(trimmed);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleGenerate();
    }
  };

  const copySnippet = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <>
      <header>
        <h1>Codeberg Activity Graph</h1>
        <p>
          Embed your Codeberg contribution graph anywhere - GitHub READMEs, websites,
          portfolios.
        </p>
      </header>

      <div className="card">
        <h2>Try it</h2>
        <div className="form-row">
          <input
            type="text"
            placeholder="Codeberg username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="button" onClick={handleGenerate}>
            Generate
          </button>
        </div>

        <div className="themes">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              className={`theme-pill${t === theme ? ' active' : ''}`}
              onClick={() => setTheme(t)}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div id="preview">
          {previewState === 'idle' && (
            <span className="placeholder">Enter a username above to preview your graph</span>
          )}
          {previewState === 'loading' && <span className="placeholder">Loading...</span>}
          {previewState === 'error' && (
            <span className="placeholder error">Error loading graph - check the username.</span>
          )}
          {previewUrl && (
            <img
              src={previewUrl}
              alt={submittedUser ? `${submittedUser}'s Codeberg activity` : 'Codeberg activity'}
              style={{ display: previewState === 'loaded' ? 'block' : 'none' }}
              onLoad={() => setPreviewState('loaded')}
              onError={() => setPreviewState('error')}
            />
          )}
        </div>
      </div>

      <div className="card">
        <h2>Embed in your GitHub README</h2>
        <div className="snippet">{snippets.markdown}</div>

        <h2 style={{ marginTop: 20 }}>HTML embed</h2>
        <div className="snippet">
          {snippets.html}
          <button
            className="copy-btn"
            type="button"
            onClick={() => copySnippet(snippets.html, 'html')}
          >
            {copiedId === 'html' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Parameters</h2>
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Values</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>?user=</td>
              <td>any Codeberg username</td>
              <td>Required. The Codeberg account to graph.</td>
            </tr>
            <tr>
              <td>?theme=</td>
              <td>codeberg · codeberg_light · github · github_light</td>
              <td>Visual theme. Defaults to codeberg.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer>
        Powered by the{' '}
        <a href="https://codeberg.org/api/swagger" target="_blank" rel="noreferrer">
          Gitea API
        </a>{' '}
        · Data refreshes every hour · Open source
      </footer>
    </>
  );
}
