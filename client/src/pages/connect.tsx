import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, CardBody } from '@wordpress/components';
import Page from '../components/page';
import SiteHeader, { SITE_HEADER_HEIGHT } from '../components/site-header';
import { getMcpUrl } from '../lib/mcp';

const COPIED_MS = 2000;

/**
 * A block of text to paste somewhere else
 */
function CopyableCode({ code, label }: { code: string; label: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPIED_MS);
    } catch {
      // The browser refused, and the text is still there to select by hand
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.75rem',
        backgroundColor: '#f6f7f7',
        borderRadius: '4px',
      }}
    >
      <pre
        style={{
          flex: 1,
          minWidth: 0,
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {code}
      </pre>
      <Button variant="secondary" size="compact" onClick={copy} label={label} showTooltip={false}>
        {isCopied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem' }}>{title}</h3>
        {children}
      </CardBody>
    </Card>
  );
}

function Assistant({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div>
      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.375rem' }}>{name}</h4>
      {children}
    </div>
  );
}

const Note = ({ children }: { children: ReactNode }) => (
  <p style={{ color: '#50575e', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>{children}</p>
);

/**
 * How to connect an AI assistant to the MCP server
 */
function Connect() {
  const [searchParams] = useSearchParams();
  const project = searchParams.get('project') ?? 'WordPress/gutenberg';
  const url = getMcpUrl();

  const questions = [
    `What got slower or faster in ${project} over the last 30 days?`,
    `Which commit caused the biggest regression in ${project} this month?`,
    `How has ${project} moved since the start of the year?`,
    'Which of the public projects has improved the most lately?',
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f6f7f7',
        paddingTop: SITE_HEADER_HEIGHT,
      }}
    >
      <SiteHeader />
      <Page
        title="Connect an AI assistant"
        description="Ask an assistant about the performance of any project with a public dashboard, through MCP."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '760px' }}>
          <Section title="Server address">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <CopyableCode code={url} label="Copy the server address" />
              <Note>
                There's nothing to sign in to. It can only read, and it only sees the projects with
                a public dashboard here.
              </Note>
            </div>
          </Section>

          <Section title="Add it to your assistant">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Assistant name="Claude">
                <Note>
                  In Settings, open Connectors and add a custom connector with the address above.
                </Note>
              </Assistant>
              <Assistant name="Claude Code">
                <CopyableCode
                  code={`claude mcp add --transport http codevitals ${url}`}
                  label="Copy the Claude Code command"
                />
              </Assistant>
              <Assistant name="Cursor">
                <CopyableCode
                  code={JSON.stringify({ mcpServers: { codevitals: { url } } }, null, 2)}
                  label="Copy the Cursor configuration"
                />
              </Assistant>
              <Assistant name="VS Code">
                <CopyableCode
                  code={JSON.stringify({ servers: { codevitals: { type: 'http', url } } }, null, 2)}
                  label="Copy the VS Code configuration"
                />
              </Assistant>
            </div>
          </Section>

          <Section title="Then try asking">
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: 1.8 }}>
              {questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </Section>
        </div>
      </Page>
    </div>
  );
}

export default Connect;
