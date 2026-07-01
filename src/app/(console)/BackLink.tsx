import Link from "next/link";

// 深层页面左上角返回键(顶层页面不用)。新仪表盘风:← + 文案。
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="back-link">
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
