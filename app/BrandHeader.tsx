import Image from "next/image";
import Link from "next/link";
import styles from "./brand-header.module.css";

/** Top bar with the Ulrike Quade Company logo, used on the office pages. */
export default function BrandHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logoLink} aria-label="Ulrike Quade Company – all shows">
        <Image
          src="/brand/uqc-logo-en.png"
          alt="Ulrike Quade Company"
          width={866}
          height={240}
          className={`brand-logo ${styles.logo}`}
          priority
        />
      </Link>
      <span className={styles.product}>Performance tool</span>
    </header>
  );
}
