import Link from "next/link";

/** Marque M — même path que la landing. */
export function MarginLogoMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="45 44 141 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M45 184V114H80V80H133V44H186V184H151V80H133V184H98V114H80V184H45Z"
      />
    </svg>
  );
}

/** Logo landing : M + « Margin » (identique à /welcome). */
export function MarginLogo({
  tone = "dark",
  href = "/welcome",
  className,
}: {
  tone?: "dark" | "light";
  href?: string | null;
  className?: string;
}) {
  const classes = [
    "land-logo",
    tone === "light" ? "land-logo--light" : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <MarginLogoMark className="land-logo__mark" />
      <span className="land-logo__name">Margin</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  return <span className={classes}>{inner}</span>;
}
