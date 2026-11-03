import type { ReactNode } from 'react';
import type { Species } from '../content/types';
import type { Pose } from './battleAnimation';

export const artUrl = (id: string) => `${import.meta.env.BASE_URL}art/${id}.png`;
/** Evolved forms have one sprite, which moves through the same lunges and shakes. */
export const poseUrl = (s: Species, pose: Pose, artId = s.artId) => artUrl(pose === 'idle' || artId !== s.artId ? artId : `${artId}-${pose}`);

export function Sprite({ id, size, flip, className, alt = '', shiny }: { id: string; size: number; flip?: boolean; className?: string; alt?: string; shiny?: boolean }) {
  const img = <img src={artUrl(id)} alt={alt} width={size} height={size} className={`sprite ${flip ? 'flip ' : ''}${shiny ? 'shiny ' : ''}${className ?? ''}`} />;
  return shiny ? <Sparkle size={size}>{img}</Sparkle> : img;
}

/** Twinkling stars around a shiny creature. */
export function Sparkle({ size, children }: { size: number; children: ReactNode }) {
  return (
    <span className="shiny-wrap" style={{ width: size, height: size }}>
      {children}
      {[0, 1, 2, 3].map((i) => <span key={i} className={`twinkle twinkle-${i}`} aria-hidden="true">✦</span>)}
    </span>
  );
}

/** A small effect sprite, decorative only. */
export const Fx = ({ id, className }: { id: string; className?: string }) => <img src={artUrl(`fx-${id}`)} alt="" className={`fx ${className ?? ''}`} />;

export function CardArt({ id, width }: { id: string; width: number }) {
  return <img src={artUrl(id)} alt="" width={width} height={(width * 96) / 128} className="sprite card-art" />;
}
