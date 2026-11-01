import type { Species } from '../content/types';
import type { Pose } from './battleAnimation';

export const artUrl = (id: string) => `${import.meta.env.BASE_URL}art/${id}.png`;
export const poseUrl = (s: Species, pose: Pose) => artUrl(pose === 'idle' ? s.artId : `${s.artId}-${pose}`);

export function Sprite({ id, size, flip, className, alt = '' }: { id: string; size: number; flip?: boolean; className?: string; alt?: string }) {
  return <img src={artUrl(id)} alt={alt} width={size} height={size} className={`sprite ${flip ? 'flip ' : ''}${className ?? ''}`} />;
}

export function CardArt({ id, width }: { id: string; width: number }) {
  return <img src={artUrl(id)} alt="" width={width} height={(width * 96) / 128} className="sprite card-art" />;
}
