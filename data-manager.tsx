import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as d3 from 'd3';

type ChartType = 'line' | 'pie' | 'bar';

export default function UploadCSVChart() {
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [xField, setXField] = useState<string>('');
  const [yField, setYField] = useState<string>('');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [showModal, setShowModal] = useState(false);
  const chartRef = useRef<SVGSVGElement | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setData([]);
          setColumns([]);
          return;
        }
        setData(results.data);
        setColumns(Object.keys(results.data[0] as object));
        setXField('');
        setYField('');
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
      },
    });
  };

  useEffect(() => {
    if (!data.length || !xField || !yField) return;
    d3.select(chartRef.current).selectAll('*').remove();

    if (chartType === 'line') drawLineChart();
    else if (chartType === 'bar') drawBarChart();
    else if (chartType === 'pie') drawPieChart();
  }, [data, chartType, xField, yField]);

  const width = 600;
  const height = 400;
  const margin = { top: 40, right: 30, bottom: 50, left: 60 };

  function drawLineChart() {
    if (!chartRef.current) return;
    const svg = d3.select(chartRef.current)
      .attr('width', width)
      .attr('height', height);

    const filteredData = data.filter(
      d => d[xField] != null && d[yField] != null && !isNaN(d[yField])
    );

    const xValues = filteredData.map(d => d[xField]);
    const isXNumeric = filteredData.every(d => typeof d[xField] === 'number');

    const xScale = isXNumeric
      ? d3.scaleLinear()
          .domain(d3.extent(xValues as number[]) as [number, number])
          .range([margin.left, width - margin.right])
      : d3.scalePoint()
          .domain(xValues)
          .range([margin.left, width - margin.right])
          .padding(0.5);

    const yValues = filteredData.map(d => +d[yField]);
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(yValues) ?? 0])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3.line<any>()
      .x((d: { [x: string]: any; }) => {
        const x = xScale(d[xField]);
        return typeof x === 'number' ? x : 0;
      })
      .y((d: { [x: string]: any; }) => yScale(d[yField]));

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(isXNumeric ? d3.axisBottom(xScale as d3.ScaleLinear<number, number>) : d3.axisBottom(xScale as d3.ScalePoint<string>))
      .selectAll("text")
      .attr("transform", "rotate(-40)")
      .style("text-anchor", "end");

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

    svg.append('path')
      .datum(filteredData)
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 2)
      .attr('d', line);

    svg.selectAll('circle')
      .data(filteredData)
      .join('circle')
      .attr('cx', (d: { [x: string]: any; }) => {
        const x = xScale(d[xField]);
        return typeof x === 'number' ? x : 0;
      })
      .attr('cy', (d: { [x: string]: any; }) => yScale(d[yField]))
      .attr('r', 4)
      .attr('fill', 'steelblue');
  }

  function drawBarChart() {
    if (!chartRef.current) return;
    const svg = d3.select(chartRef.current)
      .attr('width', width)
      .attr('height', height);

    const filteredData = data.filter(
      d => d[xField] != null && d[yField] != null && !isNaN(d[yField])
    );

    const xValues = filteredData.map(d => d[xField]);
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([margin.left, width - margin.right])
      .padding(0.2);

    const yValues = filteredData.map(d => +d[yField]);
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(yValues) ?? 0])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("transform", "rotate(-40)")
      .style("text-anchor", "end");

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

    svg.selectAll('rect')
      .data(filteredData)
      .join('rect')
      .attr('x', (d: { [x: string]: any; }) => xScale(d[xField]) ?? 0)
      .attr('y', (d: { [x: string]: any; }) => yScale(d[yField]))
      .attr('width', xScale.bandwidth())
      .attr('height', (d: { [x: string]: any; }) => yScale(0) - yScale(d[yField]))
      .attr('fill', 'orange');
  }

  function drawPieChart() {
    if (!chartRef.current) return;
    const svg = d3.select(chartRef.current)
      .attr('width', width)
      .attr('height', height);

    const radius = Math.min(width, height) / 2 - 40;

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const grouped = d3.rollups(
      data,
      (      v: any) => d3.sum(v, (d: { [x: string]: string | number; }) => +d[yField]),
      (      d: { [x: string]: any; }) => d[xField]
    );

    const pie = d3.pie<any>()
      .value((d: any[]) => d[1]);

    const arcs = pie(grouped);

    const color = d3.scaleOrdinal(d3.schemeCategory10)
      .domain(grouped.map((d: any[]) => d[0]));

    const arc = d3.arc<any>()
      .innerRadius(0)
      .outerRadius(radius);

    g.selectAll('path')
      .data(arcs)
      .join('path')
      .attr('d', arc)
      .attr('fill', (d: { data: any[]; }) => color(d.data[0]) as string)
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    g.selectAll('text')
      .data(arcs)
      .join('text')
      .attr('transform', (d: any) => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .style('font-size', '12px')
      .text((d: { data: any[]; }) => d.data[0]);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Upload CSV and Visualize with D3</h1>

      <input type="file" accept=".csv,text/csv" onChange={handleFile} />

      {columns.length > 0 && (
        <>
          <div style={{ marginTop: 20, marginBottom: 10 }}>
            <label>
              Chart Type:{' '}
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
              >
                <option value="line">Line Chart</option>
                <option value="bar">Bar Chart</option>
                <option value="pie">Pie Chart</option>
              </select>
            </label>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>
              X-axis / Category:{' '}
              <select
                value={xField}
                onChange={(e) => setXField(e.target.value)}
              >
                <option value="">-- Select --</option>
                {columns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </label>
          </div>

          {(chartType === 'line' || chartType === 'bar' || chartType === 'pie') && (
            <div style={{ marginBottom: 10 }}>
              <label>
                Y-axis / Value:{' '}
                <select
                  value={yField}
                  onChange={(e) => setYField(e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <svg ref={chartRef}></svg>

          <h2>Data Preview (Top 10 rows)</h2>
          <table
            border={1}
            cellPadding={5}
            style={{ borderCollapse: 'collapse', maxWidth: '100%', marginBottom: 10 }}
          >
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col} style={{ backgroundColor: '#eee' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col}>{row[col]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={() => setShowModal(true)} style={{ padding: '8px 16px' }}>
            View All Data
          </button>

          {showModal && (
            <div
              style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
              }}
              onClick={() => setShowModal(false)}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  padding: 20,
                  maxHeight: '80vh',
                  maxWidth: '90vw',
                  overflow: 'auto',
                  borderRadius: 8,
                  boxShadow: '0 0 10px rgba(0,0,0,0.25)',
                }}
                onClick={(e) => e.stopPropagation()} // prevent closing modal when clicking inside
              >
                <h2>Full Dataset</h2>
                <table
                  border={1}
                  cellPadding={5}
                  style={{ borderCollapse: 'collapse', width: '100%' }}
                >
                  <thead>
                    <tr>
                      {columns.map(col => (
                        <th key={col} style={{ backgroundColor: '#eee' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i}>
                        {columns.map(col => (
                          <td key={col}>{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  style={{ marginTop: 10, padding: '8px 16px' }}
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
