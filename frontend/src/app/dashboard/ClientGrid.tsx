'use client';

const Responsive = require('react-grid-layout').Responsive;
const WidthProvider = require('react-grid-layout').WidthProvider;

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function ClientGrid(props: any) {
  return <ResponsiveGridLayout {...props} />;
}
