import React from 'react';
import styles from './SearchCollapse.module.css';

export interface SearchCollapseProps {
  collapsed?: boolean;
  animate?: boolean;
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * SearchCollapse: A thin wrapper using CSS Grid 1fr <-> 0fr to collapse elements
 * smoothly to 0 height without JavaScript height measurements or breaking sticky headers.
 */
export const SearchCollapse: React.FC<SearchCollapseProps> = ({
  collapsed = false,
  animate = true,
  as: Component = 'div',
  className,
  style,
  children,
}) => {
  return (
    <Component
      className={`${styles.wrap} ${className || ''}`}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-animate={animate ? 'true' : 'false'}
      style={style}
      aria-hidden={collapsed ? 'true' : undefined}
    >
      <div className={styles.inner}>{children}</div>
    </Component>
  );
};

export default SearchCollapse;
