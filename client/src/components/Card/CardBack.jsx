import styles from './CardBack.module.css';

export default function CardBack({ count = 1, isSmall = false }) {
  return (
    <div className={`${styles.cardBack} ${isSmall ? styles.small : ''}`}>
      <div className={styles.pattern}>
        <div className={styles.inner}>
          {count > 1 && <span className={styles.count}>{count}</span>}
        </div>
      </div>
    </div>
  );
}
