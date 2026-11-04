import React from 'react';

const Skeleton = ({ width = '100%', height = '16px', radius = '8px', style = {} }) => (
  <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />
);

export default Skeleton;