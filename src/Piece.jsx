import React from 'react';
import { useDrag, DragPreviewImage } from 'react-dnd';

export default function Piece({ piece: { type, color }, position }) {

  const [{ isDragging }, drag, preview] = useDrag({
    type: 'piece',
    item: { id: `${position}_${type}_${color}`, type: 'piece' },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const pieceImage = require(`./assets/${type}_${color}.png`);

  return (
    <>
      <DragPreviewImage connect={preview} src={pieceImage} />
      <div
        ref={drag}
        className="piece-container"
        style={{ opacity: isDragging ? 0 : 1 }}
      >
        <img className="piece" src={pieceImage} alt="" />
      </div>
    </>
  );
}
