// ============================================================================
// Minimal HTML sanitizer for Warranty Invoice notes editor.
// Whitelist-based: allow common formatting tags + safe attributes.
// Strips <script>, <style>, <iframe>, on* event handlers, javascript: URIs.
// ============================================================================

const ALLOWED_TAGS = new Set([
  "p", "br", "div", "span",
  "strong", "b", "em", "i", "u", "s", "sub", "sup",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "hr",
  "a",
]);

// Allowed attributes per tag (empty set => no attributes other than style).
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  "*": new Set(["style", "class"]),
};

const STYLE_PROP_WHITELIST = new Set([
  "text-align", "font-weight", "font-style", "text-decoration",
  "padding-left", "margin-left",
]);

function sanitizeStyle(value: string): string {
  return value
    .split(";")
    .map((decl) => decl.trim())
    .filter((decl) => {
      if (!decl) return false;
      const [prop] = decl.split(":");
      return STYLE_PROP_WHITELIST.has((prop || "").trim().toLowerCase());
    })
    .join("; ");
}

function sanitizeNode(node: Node, out: Document) {
  if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    // Drop disallowed tags but keep their text children.
    const frag = out.createDocumentFragment();
    el.childNodes.forEach((child) => {
      const sanitized = sanitizeNode(child, out);
      if (sanitized) frag.appendChild(sanitized);
    });
    return frag;
  }

  const fresh = out.createElement(tag);
  // Copy whitelisted attributes
  Array.from(el.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) return; // strip event handlers
    const tagAllowed = ALLOWED_ATTRS[tag];
    const universal = ALLOWED_ATTRS["*"];
    if (!tagAllowed?.has(name) && !universal?.has(name)) return;

    let value = attr.value;
    if (name === "href") {
      // Only allow safe URLs
      if (/^\s*(javascript|data):/i.test(value)) return;
    }
    if (name === "style") {
      value = sanitizeStyle(value);
      if (!value) return;
    }
    fresh.setAttribute(name, value);
  });
  // Anchor hardening
  if (tag === "a") {
    fresh.setAttribute("rel", "noopener noreferrer nofollow");
    fresh.setAttribute("target", "_blank");
  }

  el.childNodes.forEach((child) => {
    const sanitized = sanitizeNode(child, out);
    if (sanitized) fresh.appendChild(sanitized);
  });

  return fresh;
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // SSR fallback — strip all tags conservatively
    return html.replace(/<[^>]*>/g, "");
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const wrapper = doc.body.firstElementChild;
  if (!wrapper) return "";
  const out = document.implementation.createHTMLDocument("");
  const cleanWrapper = out.createElement("div");
  wrapper.childNodes.forEach((child) => {
    const sanitized = sanitizeNode(child, out);
    if (sanitized) cleanWrapper.appendChild(sanitized);
  });
  return cleanWrapper.innerHTML;
}
