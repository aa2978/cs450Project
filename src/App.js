import React, { Component } from 'react';
import * as d3 from 'd3';
//import Papa from 'papaparse';
import './App.css';
import heart_data from './heart_data.csv';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      filteredData: [],
      sliderValue: 0,
      minAge: 0,
      maxAge: 100,
      numPoints: 1000,
      pendingNumPoints: 1000,
      heatmapData: [],
      heatmapFilter: 'all',
      selectedGroup: "smoke"
    };
    this.svgRef = React.createRef();
    this.tooltipRef = React.createRef();
    this.heatmapRef = React.createRef();
    this.barChartRef = React.createRef();
  }

  componentDidMount() {
    d3.csv(heart_data, row => {
      const ageInYearsFloat = parseFloat((+row.age / 365).toFixed(2));
      const ageInYearsInt = Math.floor(ageInYearsFloat);
      const heightInMeters = +row.height / 100;
      const bmi = +row.weight / (heightInMeters * heightInMeters);
      return {
        index: +row.index,
        id: +row.id,
        age_days: +row.age,
        age_years: ageInYearsInt,
        age_years_float: ageInYearsFloat,
        gender: +row.gender,
        height: +row.height,
        weight_kg: +row.weight,
        weight_lb: +(row.weight * 2.20462).toFixed(2),
        ap_hi: +row.ap_hi,
        ap_lo: +row.ap_lo,
        cholesterol: +row.cholesterol,
        glucose: +row.gluc,
        smoke: +row.smoke,
        alcohol: +row.alco,
        active: +row.active,
        cardio: +row.cardio,
        bmi: bmi.toFixed(2),
      };
    }).then(allData => {
      const ages = allData.map(d => d.age_years);
      const minAge = d3.min(ages);
      const maxAge = d3.max(ages);
      this.setState({
        data: allData,
        filteredData: allData.slice(0, 1000),
        sliderValue: maxAge,
        minAge,
        maxAge,
        numPoints: 1000,
        heatmapData: allData,
      }, () => {
        this.initializeChart();
        this.filterData();
        this.updateChart();
        this.updateXAxis();
        this.drawHeatmap();
        this.drawBarChart();
      });
    });
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.sliderValue !== this.state.sliderValue && this.xScale) {
      this.filterData();
      this.updateChart();
      this.updateXAxis();
    }
    if (prevState.heatmapFilter !== this.state.heatmapFilter) {
      this.drawHeatmap();
    }
  }

  filterData = () => {
    const { data, sliderValue, numPoints } = this.state;
    const filteredData = data.filter(d => d.age_years_float <= sliderValue).slice(0, numPoints);
    this.setState({ filteredData });
  };

  initializeChart = () => {
    const svg = d3.select(this.svgRef.current).attr('width', 800).attr('height', 600);
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    this.width = width;
    this.height = height;
    this.margin = margin;

    this.chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    this.xScale = d3.scaleLinear().domain([this.state.minAge, this.state.maxAge]).range([0, width]);

    const weights = this.state.data.map(d => d.weight_lb);
    this.yScale = d3.scaleLinear().domain([d3.min(weights) - 5, d3.max(weights) + 5]).range([height, 0]);

    this.xAxisGroup = this.chart.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(this.xScale));
    this.yAxisGroup = this.chart.append('g').call(d3.axisLeft(this.yScale));

    this.chart.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50)
      .attr('x', -height / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('Weight (lbs)');
  };

  updateXAxis = () => {
    const { sliderValue, minAge } = this.state;
    this.xScale.domain([minAge, sliderValue]);
    this.xAxisGroup.transition().duration(500).call(d3.axisBottom(this.xScale));
  };

  updateChart = () => {
    const svg = d3.select(this.svgRef.current);
    const chartGroup = svg.select('g');
    const { filteredData } = this.state;

    const ages = filteredData.map(d => d.age_years_float);
    const weights = filteredData.map(d => d.weight_lb);
    this.xScale.domain([d3.min(ages), d3.max(ages)]);
    this.yScale.domain([d3.min(weights) - 5, d3.max(weights) + 5]);

    this.xAxisGroup.transition().duration(500).call(d3.axisBottom(this.xScale));
    this.yAxisGroup.transition().duration(500).call(d3.axisLeft(this.yScale));

    const circles = chartGroup.selectAll('circle').data(filteredData);
    circles.exit().remove();
    circles.transition().duration(500)
      .attr('cx', d => this.xScale(d.age_years_float))
      .attr('cy', d => this.yScale(d.weight_lb));
    circles.enter().append('circle')
      .attr('cx', d => this.xScale(d.age_years_float))
      .attr('cy', d => this.yScale(d.weight_lb))
      .attr('r', d => d.cardio === 1 ? 4 : 3)
      .attr('fill', d => d.cardio === 1 ? 'red' : 'steelblue')
      .on('mouseover', this.handleMouseOver)
      .on('mouseout', this.handleMouseOut);
  };

  handleMouseOver = (event, d) => {
    const tooltip = d3.select(this.tooltipRef.current);
    tooltip.style('visibility', 'visible')
      .html(`ID: ${d.id}<br/>Age: ${d.age_years}<br/>Weight: ${d.weight_lb} lbs<br/>Cardio: ${d.cardio}`)
      .style('left', `${event.pageX + 5}px`)
      .style('top', `${event.pageY - 28}px`);
  };

  handleMouseOut = () => {
    d3.select(this.tooltipRef.current).style('visibility', 'hidden');
  };

  computeCorrelation = (x, y) => {
    const avgX = d3.mean(x);
    const avgY = d3.mean(y);
    const numerator = d3.sum(x.map((xi, i) => (xi - avgX) * (y[i] - avgY)));
    const denominatorX = Math.sqrt(d3.sum(x.map(xi => (xi - avgX) ** 2)));
    const denominatorY = Math.sqrt(d3.sum(y.map(yi => (yi - avgY) ** 2)));
    return denominatorX && denominatorY ? numerator / (denominatorX * denominatorY) : 0;
  };

  drawHeatmap = () => {
    const { heatmapData, heatmapFilter } = this.state;
    const tooltip = d3.select('body').selectAll('.tooltip').data([0]).join('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('background-color', 'white')
      .style('position', 'absolute')
      .style('border', '1px solid gray');

    const filtered = heatmapFilter === 'all'
      ? heatmapData
      : heatmapData.filter(d => d.cardio === (heatmapFilter === 'cardio_1' ? 1 : 0));

    const metrics = ["age", "height", "weight_kg", "ap_hi", "ap_lo", "cholesterol", "glucose", "cardio"];
    const data = [];

    metrics.forEach(v1 => {
      metrics.forEach(v2 => {
        data.push({
          variable1: v1,
          variable2: v2,
          correlation: this.computeCorrelation(filtered.map(d => d[v1]), filtered.map(d => d[v2]))
        });
      });
    });

    const svg = d3.select(this.heatmapRef.current).attr('width', 500).attr('height', 500);
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const inner_width = 400, inner_height = 400;

    const heatmap = svg.selectAll('g').data([0]).join('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().range([0, inner_width]).domain(metrics).padding(0.01);
    const y = d3.scaleBand().range([inner_height, 0]).domain(metrics).padding(0.01);
    const color = d3.scaleLinear().range(['blue', 'white', 'red']).domain([-1, 0, 1]);

    heatmap.selectAll('rect').data(data).join('rect')
      .attr('x', d => x(d.variable1))
      .attr('y', d => y(d.variable2))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => color(d.correlation))
      .on('mouseover', () => tooltip.style('opacity', 1))
      .on('mousemove', (event, d) => {
        tooltip
          .style('left', `${event.pageX}px`)
          .style('top', `${event.pageY - 25}px`)
          .html(`Correlation of ${d.variable1} and ${d.variable2}: ${d.correlation.toFixed(2)}`);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));

    heatmap.selectAll('.x-axis').data([0]).join('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${inner_height})`)
      .call(d3.axisBottom(x));

    heatmap.selectAll('.y-axis').data([0]).join('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y));
  };

  drawBarChart() {
    const width = 500;
    const height = 600;
    const svg = d3.select(this.barChartRef.current).attr('width', width).attr('height', height);
    const barWidth = 50;
    const gapBetweenBars = 100;
  
    // Clear previous elements
    svg.selectAll('rect').remove();
    svg.selectAll('.tooltip').remove();
    svg.selectAll('.axis-group').remove();
    svg.selectAll('text').remove(); // remove previous labels
  
    // Tooltip setup
    const tooltip = d3.select(".charts")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("padding", "5px 10px")
      .style("border-radius", "4px")
      .style("pointer-events", "none");
  
    function showTooltip(event, d) {
      tooltip.transition().duration(200).style("opacity", 1);
      tooltip.html(`${d.group}<br/>${d.label}: ${d.count}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px");
    }
  
    function hideTooltip() {
      tooltip.transition().duration(200).style("opacity", 0);
    }
  
    // Grouping logic
    const groupKey = this.state.selectedGroup;
    const groupLabels = {
      smoke: ["Non-smokers", "Smokers"],
      alcohol: ["Non-drinkers", "Drinkers"],
      active: ["Non-active", "Active"]
    };
  
    const groupFilter = {
      smoke: [0, 1],
      alcohol: [0, 1],
      active: [0, 1]
    };
  
    const values = groupFilter[groupKey];
  
    const counts = values.map((value, idx) => ({
      groupLabel: groupLabels[groupKey][idx],
      cardio_1: this.state.data.filter(d => +d[groupKey] === value && +d.cardio === 1).length,
      cardio_0: this.state.data.filter(d => +d[groupKey] === value && +d.cardio === 0).length
    }));
  
    const totals = counts.map(c => c.cardio_1 + c.cardio_0);
    const yScales = totals.map(total =>
      d3.scaleLinear().domain([0, total]).range([height - 50, 50])
    );
  
    const barPositions = [
      50 + barWidth,
      50 + barWidth + gapBetweenBars
    ];
  
    // Draw bars for both groups
    counts.forEach((c, i) => {
      // Cardio = 1
      svg.append('rect')
        .datum({ group: c.groupLabel, label: "Cardio (1)", count: c.cardio_1 })
        .attr('x', barPositions[i])
        .attr('y', yScales[i](c.cardio_1))
        .attr('width', barWidth)
        .attr('height', height - 50 - yScales[i](c.cardio_1))
        .attr('fill', '#1f77b4')
        .on("mouseover", showTooltip)
        .on("mousemove", showTooltip)
        .on("mouseout", hideTooltip);
  
      // Cardio = 0
      svg.append('rect')
        .datum({ group: c.groupLabel, label: "Cardio (0)", count: c.cardio_0 })
        .attr('x', barPositions[i])
        .attr('y', yScales[i](totals[i]))
        .attr('width', barWidth)
        .attr('height', height - 50 - yScales[i](c.cardio_0))
        .attr('fill', '#ff7f0e')
        .on("mouseover", showTooltip)
        .on("mousemove", showTooltip)
        .on("mouseout", hideTooltip);
    });
  
    // Add y-axis label
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 20)
      .attr("dy", "1em")
      .style("font-size", "14px")
      .style("fill", "#333")
      .style("font-weight", "bold")
      .text("# of individuals");
  
    // Add y-axes
    yScales.forEach((scale, i) => {
      svg.append("g")
        .attr("class", "axis-group")
        .attr("transform", `translate(${barPositions[i] - 10 + (i === 1 ? barWidth + 20 : 0)}, 0)`)
        .call(i === 0 ? d3.axisLeft(scale).ticks(5) : d3.axisRight(scale).ticks(5));
    });
  
    // Add group labels under bars
    counts.forEach((c, i) => {
      svg.append("text")
        .attr("x", barPositions[i] + barWidth / 2)
        .attr("y", height - 30)
        .attr("text-anchor", "middle")
        .text(c.groupLabel)
        .style("font-size", "10px")
        .style("fill", "#333");
    });
  
    // Legend
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${2 * width / 3}, 50)`);
  
    const legendItems = [
      { label: "Cardio = 1", color: "#1f77b4" },
      { label: "Cardio = 0", color: "#ff7f0e" }
    ];
  
    legendItems.forEach((item, i) => {
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${i * 25})`);
  
      legendRow.append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", item.color);
  
      legendRow.append("text")
        .attr("x", 30)
        .attr("y", 15)
        .text(item.label)
        .attr("text-anchor", "start")
        .style("alignment-baseline", "middle")
        .style("font-size", "14px")
        .style("fill", "#333");
    });
  }
  

  updateGroup = (group) => {
    this.setState({ selectedGroup: group }, () => {
      this.drawBarChart();
    });
  }

  render() {
    const { minAge, maxAge, sliderValue, pendingNumPoints, heatmapFilter } = this.state;

    return (
      <div className="App">
        <h2>Scatterplot: Age vs Weight</h2>
        <input type="range" min={minAge} max={maxAge} value={sliderValue}
          onChange={e => this.setState({ sliderValue: +e.target.value })} />
        <div>Selected Age: {sliderValue}</div>
        <label>
          Number of Points:
          <input type="number" min="1" max="70000" value={pendingNumPoints}
            onChange={e => this.setState({ pendingNumPoints: Math.max(1, +e.target.value) })} />
        </label>
        <button onClick={() => {
          const { pendingNumPoints } = this.state;
          this.setState(prev => ({
            numPoints: pendingNumPoints,
            filteredData: prev.data.filter(d => d.age_years_float <= prev.sliderValue).slice(0, pendingNumPoints)
          }), this.updateChart);
        }}>Update Points</button>

        <svg ref={this.svgRef}></svg>
        <div ref={this.tooltipRef} style={{
          position: 'absolute',
          visibility: 'hidden',
          background: 'lightgray',
          padding: '5px',
          borderRadius: '5px'
        }}></div>

        <h2>Correlation Heatmap</h2>
        <select value={heatmapFilter} onChange={e => this.setState({ heatmapFilter: e.target.value })}>
          <option value="all">All</option>
          <option value="cardio_1">Cardio = 1</option>
          <option value="cardio_0">Cardio = 0</option>
        </select>
        <svg ref={this.heatmapRef}></svg>

        <h2>Cardio Bar Chart</h2>
        <div style={{ marginBottom: "10px" }}>
          <button onClick={() => this.updateGroup("smoke")}>Smokers</button>
          <button onClick={() => this.updateGroup("alcohol")}>Alcohol</button>
          <button onClick={() => this.updateGroup("active")}>Active</button>
        </div>
        <div className="charts">
          <svg ref={this.barChartRef}></svg>
        </div>
      </div>
    );
  }
}

export default App;
