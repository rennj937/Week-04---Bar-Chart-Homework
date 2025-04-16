// Joshua Renner

import * as d3 from 'd3';

const app = d3.select('#app');

async function getData() {
    const url = new URL('https://data.cityofnewyork.us/resource/erm2-nwe9.json');

    // Get today's date and the date one year ago
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);

    // Format dates
    const formatDate = date => date.toISOString().split('T')[0];

    url.searchParams.set('$query', `
        SELECT * WHERE
            LOWER(complaint_type) LIKE '%noise%'
        AND
            created_date BETWEEN '${formatDate(lastYear)}T00:00:00.000' AND '${formatDate(today)}T23:59:59.999'
    `);

    const data = await d3.json(url.href);
    console.log("Raw API Data:", data);
    return data;
};

const apiData = await getData();

//                  Murray Hill (Ctrl Grp), West Vil., HK, W.Burg, LIC 
const selectedZipCodes = ['10016', '10014', '10019', '11211', '11101'];

const zipToNeighborhood = {
    '10016': 'Murray Hill (10016)',
    '10014': 'West Village (10014)',
    '10019': 'Hells Kitchen (10019)',
    '11211': 'Williamsburg (11211)',
    '11101': 'Long Island City (11101)',
};

// Filter dataset to only selected ZIP codes
const filteredData = apiData.filter(d =>
    selectedZipCodes.includes(d.incident_zip) && d.descriptor
);
console.log("Filtered Data:", filteredData);

// Group data by ZIP and then descriptor
const nestedData = d3.group(filteredData, d => d.incident_zip, d => d.descriptor);

// Stacked bar format
const zipData = Array.from(nestedData, ([zip, descriptors]) => {
    let obj = { zip };
    Array.from(descriptors, ([desc, records]) => {
        obj[desc] = records.length;
    });
    return obj;
});

console.log("Formatted Data for Stacking:", zipData);

// Extract Subcategories for stacking
const descriptors = Array.from(new Set(filteredData.map(d => d.descriptor)));

console.log("Unique Descriptors:", descriptors);

// SVG container
const width = 900;
const height = 550;
const margin = { top: 100, right: 350, bottom: 100, left: 60 };

const svg = app.append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('background-color', '#3E424B')
    .style('border', '.5px solid black');

// X-Axis Scale (ZIP codes)
const xScale = d3.scaleBand()
    .domain(selectedZipCodes) // Ensure order is correct
    .range([margin.left, width - margin.right])
    .padding(0.2);

// Y-Axis Scale
const yScale = d3.scaleLinear()
    .domain([0, d3.max(zipData, d =>
        d3.sum(descriptors, key => d[key] || 0) // Sum up all descriptor counts for each ZIP
    )])
    .range([height - margin.bottom, margin.top]);

// Color Scale
svg.append("defs")
    .append("pattern")
    .attr("id", "crosshatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 6)
    .attr("height", 6)
    .append("path")
    .attr("d", "M0,0 L6,6 M6,0 L0,6")
    .attr("stroke", "white")
    .attr("stroke-width", 1);

const lavenderShades = [
    "#BA55D3", // Medium Orchid
    "#9370DB", // Medium Purple
    "#8A2BE2", // Blue Violet
    "#DDA0DD", // Plum
    "#C3B1E1", // Lilac
    "#B39EB5",  // Pastel Purple
    "#D8BFD8", // Thistle
    "#7B68EE", // Medium Slate Blue
    "#6A5ACD", // Slate Blue
];

// Assign
const colorScale = d3.scaleOrdinal()
    .domain(descriptors)
    .range(descriptors.map(desc => desc === "Loud Music/Party" ? "url(#crosshatch)" : lavenderShades[descriptors.indexOf(desc)]));

// Stack Data
const stackedData = d3.stack()
    .keys(descriptors) // Stack by descriptor type
    (zipData)
    .map(d => (d.forEach(v => v.key = d.key), d));

console.log("Stacked Data:", stackedData);

// Bar Groups
const barLayer = svg.append('g');

barLayer.selectAll("g")
    .data(stackedData)
    .join("g")
    .attr("fill", d => colorScale(d.key)) // Color each segment
    .selectAll("rect")
    .data(d => d)
    .join("rect")
    .attr("x", d => xScale(d.data.zip))
    .attr("y", d => yScale(d[1])) // Upper boundary of the segment
    .attr("height", d => yScale(d[0]) - yScale(d[1])) // Height of the segment
    .attr("width", xScale.bandwidth());

// X-Axis
const xAxis = svg.append('g')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).tickSize(0).tickFormat(() => "")) // Remove default labels
    .selectAll('.domain, .tick line')
    .style('stroke', 'white');

// Custom labels
const xLabels = svg.append('g')
    .attr('transform', `translate(0, ${height - margin.bottom + 10})`) // Adjust placement
    .selectAll('g')
    .data(selectedZipCodes)
    .join('g')
    .attr('transform', d => `translate(${xScale(d) + xScale.bandwidth() / 2}, 0)`) // Center text
    .each(function (d) {
        const group = d3.select(this);

        group.append('text')
            .text(zipToNeighborhood[d].split(' (')[0]) // Extract neighborhood name
            .attr('text-anchor', 'middle')
            .attr('dy', '0.5em')
            .attr('fill', 'white')
            .attr('font-size', '12px')  // Set consistent font size
            .attr('font-family', 'sans-serif');

        group.append('text')
            .text(`(${d})`) // Display ZIP code below
            .attr('dy', '1.8em')
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '12px')  // Set consistent font size
            .attr('font-family', 'sans-serif');
    });

// Y-Axis
svg.append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale))
    .selectAll('text')
    .style('fill', 'white');

// Legend
const legend = svg.append("g")
    .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

descriptors.forEach((desc, i) => {
    const g = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
    g.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", colorScale(desc));
    g.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .text(desc)
        .attr("font-size", "12px");
});

//Final Tweaks
svg.selectAll('.domain, .tick line')
    .style('stroke', 'white');

legend.selectAll("text")
    .style("fill", "white");

// Get today's date and the date one year ago for Title
const today = new Date();
const lastYear = new Date();
lastYear.setFullYear(today.getFullYear() - 1);

// Format dates
const formatDate = date => date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const dateRangeText = `(${formatDate(lastYear)} - ${formatDate(today)})`;

// Title
svg.append('text')
    .attr('x', width / 3) // Center the title
    .attr('y', height - 520) // Position near the bottom
    .attr('text-anchor', 'middle') // Center align
    .attr('fill', 'white') // White text color
    .attr('font-size', '16px') // Slightly larger for emphasis
    .attr('font-family', 'sans-serif')
    .text(`311 Noise Complaints by Neighborhood ${dateRangeText}`);

// Interactive Hover
barLayer.selectAll("rect")
    .on("mouseover", function (event, d) {
        // Create the tooltip when mouseover occurs
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('background-color', 'rgba(0, 0, 0, 0.7)')
            .style('color', 'white')
            .style('padding', '5px')
            .style('border-radius', '4px')
            .style('pointer-events', 'none')
            .style('opacity', 0) // Start with opacity 0
            .html(`Zip: ${d.data.zip}<br>Descriptor: ${d.key}<br>Count: ${d[1] - d[0]}`)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 30}px`)
            .transition().duration(200)
            .style('opacity', 1); // Fade in the tooltip
    })
    .on("mousemove", function (event) {
        // Move the tooltip with the mouse
        d3.select('.tooltip')
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 30}px`);
    })
    .on("mouseout", function () {
        // Fade out the tooltip when mouseout occurs
        d3.select('.tooltip').transition().duration(200).style('opacity', 0).remove();
    });

// ChatGPT used for: ziptoneighborhood, hatch fill, interactive hover, and minor alignment de-bugging.