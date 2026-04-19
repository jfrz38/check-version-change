export interface XmlNode {
  name: string;
  children: XmlNode[];
  text: string;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&amp;/g, '&');
}

function normalizeTagName(name: string): string {
  const trimmed = name.trim();
  const colonIndex = trimmed.indexOf(':');
  return colonIndex >= 0 ? trimmed.slice(colonIndex + 1) : trimmed;
}

export function parseXml(content: string): XmlNode {
  const sanitized = content
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const root: XmlNode = { name: '__root__', children: [], text: '' };
  const stack: XmlNode[] = [root];
  const tokenPattern = /<[^>]+>|[^<]+/g;

  for (const token of sanitized.match(tokenPattern) ?? []) {
    if (!token) {
      continue;
    }

    if (!token.startsWith('<')) {
      const text = decodeXmlText(token).trim();
      if (text) {
        const current = stack[stack.length - 1];
        current.text = current.text ? `${current.text} ${text}` : text;
      }
      continue;
    }

    if (token.startsWith('</')) {
      const tagName = normalizeTagName(token.slice(2, -1));
      const current = stack.pop();
      if (!current || current.name !== tagName) {
        throw new Error(`Malformed XML: unexpected closing tag </${tagName}>.`);
      }
      continue;
    }

    if (token.startsWith('<!')) {
      continue;
    }

    const selfClosing = token.endsWith('/>');
    const inner = token.slice(1, selfClosing ? -2 : -1).trim();
    const tagName = normalizeTagName(inner.split(/\s+/, 1)[0]);
    const node: XmlNode = { name: tagName, children: [], text: '' };
    stack[stack.length - 1].children.push(node);

    if (!selfClosing) {
      stack.push(node);
    }
  }

  if (stack.length !== 1 || root.children.length !== 1) {
    throw new Error('Malformed XML: document structure is invalid.');
  }

  return root.children[0];
}

export function getChild(node: XmlNode, childName: string): XmlNode | undefined {
  return node.children.find((child) => child.name === childName);
}

export function getChildText(node: XmlNode, childName: string): string | undefined {
  const child = getChild(node, childName);
  return child?.text?.trim() || undefined;
}
