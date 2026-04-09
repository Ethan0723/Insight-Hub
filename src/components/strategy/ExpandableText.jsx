import { useMemo, useState } from "react";

function ExpandableText({ text, collapsedChars = 160, defaultExpanded = false, className = "" }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const fullText = String(text || "").trim();

  const previewText = useMemo(() => {
    if (fullText.length <= collapsedChars) return fullText;
    const cut = fullText.slice(0, collapsedChars);
    const safeCut = cut.lastIndexOf(" ") > Math.floor(collapsedChars * 0.65) ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
    return safeCut.trim();
  }, [fullText, collapsedChars]);

  if (!fullText) {
    return <p className={`whitespace-normal break-words ${className}`}>暂无内容</p>;
  }

  const shouldCollapse = fullText.length > collapsedChars;

  return (
    <div>
      <p className={`whitespace-normal break-words ${className}`}>
        {expanded || !shouldCollapse ? fullText : previewText}
      </p>
      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="app-accent-text mt-1 text-[11px] underline-offset-4 hover:underline"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      ) : null}
    </div>
  );
}

export default ExpandableText;
