import React from 'react'
import styles from '../styles/Spinner.module.css'

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large'
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'medium' }) => {
  return (
    <div className={`${styles.spinner} ${styles[size]}`}>
      <div className={styles.bounce1}></div>
      <div className={styles.bounce2}></div>
      <div className={styles.bounce3}></div>
    </div>
  )
} 