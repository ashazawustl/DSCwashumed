// SVG Size
var width = 700,
    height = 500;

// Test that D3 is working first
console.log("D3 version:", d3.version);

// Create SVG container
const svg = d3.select("#chart-area")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

// All 24 mouse samples from your real data
const mouseData = [
    {sampleId: "5410", wbc: 13.42, neutrophils: 2.5, lymphocytes: 9.81, monocytes: 0.66, eosinophils: 0.34, basophils: 0.11, rbc: 8.91, hemoglobin: 14.6, hematocrit: 43.8, platelets: 888, date: "4/1/2025", time: "10:27", operator: "Schuettpelz", wbcMessage: "Leukocytosis"},
    {sampleId: "5409", wbc: 11.14, neutrophils: 1.41, lymphocytes: 8.99, monocytes: 0.5, eosinophils: 0.18, basophils: 0.06, rbc: 8.71, hemoglobin: 14, hematocrit: 42.9, platelets: 1074, date: "4/1/2025", time: "10:25", operator: "Schuettpelz", wbcMessage: ""},
    {sampleId: "5408", wbc: 12.75, neutrophils: 2.46, lymphocytes: 9.14, monocytes: 0.84, eosinophils: 0.22, basophils: 0.09, rbc: 8.18, hemoglobin: 13.6, hematocrit: 41.8, platelets: 1049, date: "4/1/2025", time: "10:24", operator: "Schuettpelz", wbcMessage: "Leukocytosis"},
    {sampleId: "5407", wbc: 13.50, neutrophils: 3.31, lymphocytes: 9.56, monocytes: 0.41, eosinophils: 0.13, basophils: 0.09, rbc: 9.04, hemoglobin: 14.4, hematocrit: 44.7, platelets: 1110, date: "4/1/2025", time: "10:23", operator: "Schuettpelz", wbcMessage: "Leukocytosis"},
    {sampleId: "5406", wbc: 20.72, neutrophils: 4.26, lymphocytes: 14.39, monocytes: 1.60, eosinophils: 0.36, basophils: 0.11, rbc: 8.18, hemoglobin: 13.1, hematocrit: 41.1, platelets: 986, date: "4/1/2025", time: "10:22", operator: "Schuettpelz", wbcMessage: "Leukocytosis, Lymphocytosis"},
];

// Sample relationships based on your bio research needs
const relationships = [
    // Temporal sequence (samples taken in order)
    {source: "5410", target: "5409", type: "temporal_proximity", strength: 0.8},
    {source: "5409", target: "5408", type: "temporal_proximity", strength: 0.8},
    {source: "5408", target: "5407", type: "temporal_proximity", strength: 0.8},
    {source: "5407", target: "5406", type: "temporal_proximity", strength: 0.8},
    
    
    // Similar WBC levels
    {source: "5410", target: "5408", type: "similar_wbc", strength: 0.6}, // 13.42 vs 12.75
    {source: "5410", target: "5407", type: "similar_wbc", strength: 0.6}, // 13.42 vs 13.50
    
    // High WBC cluster (leukocytosis)
    {source: "5406", target: "5410", type: "leukocytosis_group", strength: 0.7}, // Both high WBC
    {source: "5406", target: "5407", type: "leukocytosis_group", strength: 0.7}
];

console.log("Mouse data:", mouseData);
console.log("Relationships:", relationships);
console.log("Total mice: " + mouseData.length);
console.log("Total relationships: " + relationships.length);

// Create tooltip/popup div
const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "fixed")
    .style("background", "rgba(0, 0, 0, 0.95)")
    .style("color", "white")
    .style("padding", "20px")
    .style("border-radius", "10px")
    .style("border", "2px solid #666")
    .style("font-size", "12px")
    .style("max-width", "450px")
    .style("max-height", "600px")
    .style("overflow-y", "auto")
    .style("display", "none")
    .style("z-index", "1000")
    .style("box-shadow", "0 4px 20px rgba(0,0,0,0.5)");

let tooltipVisible = false;
let currentSelectedNode = null;

// Create force simulation
const simulation = d3.forceSimulation(mouseData)
    .force("link", d3.forceLink(relationships)
        .id(d => d.sampleId)
        .distance(d => {
            // Different distances for different relationship types
            switch(d.type) {
                case "temporal_proximity": return 60;
                case "leukocytosis_group": return 40;
                case "leukopenia_group": return 30;
                case "anemia_group": return 35;
                case "same_operator": return 80;
                case "similar_wbc": return 50;
                default: return 70;
            }
        })
        .strength(d => d.strength || 0.5))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(25));

// Draw relationship lines
const link = svg.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(relationships)
    .enter().append("line")
    .attr("stroke", d => {
        // Color code by relationship type
        switch(d.type) {
            case "temporal_proximity": return "#999";
            case "leukocytosis_group": return "#ff6b6b";
            case "leukopenia_group": return "#4ecdc4";
            case "similar_wbc": return "#ff9ff3";
            default: return "#999";
        }
    })
    .attr("stroke-width", d => Math.sqrt(d.strength * 3))
    .attr("stroke-opacity", 0.6);

// Draw mouse nodes
const node = svg.append("g")
    .attr("class", "nodes")
    .selectAll("circle")
    .data(mouseData)
    .enter().append("circle")
    .attr("r", 15)
    .style("fill", d => {
        // Color coding based on WBC levels
        if (d.wbc > 15) return "#ff4757"; // Very high WBC - dark red
        if (d.wbc > 12) return "#ff6b6b"; // High WBC - red
        if (d.wbc > 8) return "#95e1d3";  // Normal WBC - light green
        if (d.wbc > 3) return "#4ecdc4";  // Low WBC - teal
        return "#2f3542";                 // Very low WBC - dark
    })
    .style("stroke", "#333")
    .style("stroke-width", 2)
    .style("cursor", "pointer")
    .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
    .on("mouseover", function(event, d) {
        if (currentSelectedNode !== d3.select(this)) {
            d3.select(this).transition().attr("r", 18);
        }
    })
    .on("mouseout", function(event, d) {
        if (currentSelectedNode !== d3.select(this)) {
            d3.select(this).transition().attr("r", 15);
        }
    })
    .on("click", function(event, d) {
        console.log("Clicked mouse:", d);
        
        if (tooltipVisible && currentSelectedNode === d3.select(this)) {
            hideTooltip();
            return;
        }
        
        if (currentSelectedNode) {
            currentSelectedNode.transition().attr("r", 15).style("stroke-width", 2);
        }
        
        currentSelectedNode = d3.select(this);
        currentSelectedNode.transition().attr("r", 20).style("stroke-width", 4);
        
        showTooltip(d);
    });

// Add labels
const label = svg.append("g")
    .attr("class", "labels")
    .selectAll("text")
    .data(mouseData)
    .enter().append("text")
    .attr("text-anchor", "middle")
    .attr("dy", 4)
    .text(d => d.sampleId)
    .style("fill", "white")
    .style("font-size", "9px")
    .style("font-weight", "bold")
    .style("pointer-events", "none");

// Update positions on simulation tick
simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

    label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
});

// Drag functions
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

// Function to create detailed table HTML
function createMouseTable(mouseData) {
    let tableHTML = `
        <h3 style="margin-top: 0; text-align: center; color: #fff;">Mouse Sample: ${mouseData.sampleId}</h3>
        <table style="width: 100%; border-collapse: collapse; color: white;">
            <tr style="border-bottom: 2px solid #666;">
                <td style="padding: 8px; font-weight: bold;">Field</td>
                <td style="padding: 8px; font-weight: bold;">Value</td>
                <td style="padding: 8px; font-weight: bold;">Unit</td>
            </tr>
    `;

    // Blood cell counts
    tableHTML += `
        <tr><td colspan="3" style="background: #444; padding: 8px; font-weight: bold;">Blood Cell Counts</td></tr>
        <tr><td style="padding: 5px;">WBC</td><td style="padding: 5px;">${mouseData.wbc}</td><td style="padding: 5px;">10³/uL</td></tr>
        <tr><td style="padding: 5px;">Neutrophils</td><td style="padding: 5px;">${mouseData.neutrophils}</td><td style="padding: 5px;">10³/uL</td></tr>
        <tr><td style="padding: 5px;">Lymphocytes</td><td style="padding: 5px;">${mouseData.lymphocytes}</td><td style="padding: 5px;">10³/uL</td></tr>
        <tr><td style="padding: 5px;">Monocytes</td><td style="padding: 5px;">${mouseData.monocytes}</td><td style="padding: 5px;">10³/uL</td></tr>
        <tr><td style="padding: 5px;">Eosinophils</td><td style="padding: 5px;">${mouseData.eosinophils}</td><td style="padding: 5px;">10³/uL</td></tr>
        <tr><td style="padding: 5px;">Basophils</td><td style="padding: 5px;">${mouseData.basophils}</td><td style="padding: 5px;">10³/uL</td></tr>
    `;

    // Red blood cell data
    tableHTML += `
        <tr><td colspan="3" style="background: #444; padding: 8px; font-weight: bold;">Red Blood Cells</td></tr>
        <tr><td style="padding: 5px;">RBC</td><td style="padding: 5px;">${mouseData.rbc}</td><td style="padding: 5px;">10⁶/uL</td></tr>
        <tr><td style="padding: 5px;">Hemoglobin</td><td style="padding: 5px;">${mouseData.hemoglobin}</td><td style="padding: 5px;">g/dL</td></tr>
        <tr><td style="padding: 5px;">Hematocrit</td><td style="padding: 5px;">${mouseData.hematocrit}</td><td style="padding: 5px;">%</td></tr>
        <tr><td style="padding: 5px;">Platelets</td><td style="padding: 5px;">${mouseData.platelets}</td><td style="padding: 5px;">10³/uL</td></tr>
    `;

    // Sample information
    tableHTML += `
        <tr><td colspan="3" style="background: #444; padding: 8px; font-weight: bold;">Sample Information</td></tr>
        <tr><td style="padding: 5px;">Date</td><td style="padding: 5px;">${mouseData.date}</td><td style="padding: 5px;"></td></tr>
        <tr><td style="padding: 5px;">Time</td><td style="padding: 5px;">${mouseData.time}</td><td style="padding: 5px;"></td></tr>
        <tr><td style="padding: 5px;">Operator</td><td style="padding: 5px;">${mouseData.operator}</td><td style="padding: 5px;"></td></tr>
    `;

    if (mouseData.wbcMessage) {
        tableHTML += `
            <tr><td colspan="3" style="background: #444; padding: 8px; font-weight: bold;">Medical Notes</td></tr>
            <tr><td colspan="3" style="padding: 8px; background: #333;">${mouseData.wbcMessage}</td></tr>
        `;
    }

    tableHTML += `</table>
        <div style="margin-top: 15px; text-align: center;">
            <button onclick="hideTooltip()" style="padding: 8px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">Close</button>
        </div>
    `;

    return tableHTML;
}

// Function to hide tooltip
window.hideTooltip = function() {
    tooltip.style("display", "none");
    tooltipVisible = false;
    
    if (currentSelectedNode) {
        currentSelectedNode.transition().attr("r", 15).style("stroke-width", 2);
        currentSelectedNode = null;
    }
};

// Function to show tooltip
function showTooltip(mouseData) {
    tooltip.html(createMouseTable(mouseData))
        .style("display", "block")
        .style("left", "80%")
        .style("top", "50%")
        .style("transform", "translate(-50%, -50%)");
    tooltipVisible = true;
}

// Add legend for relationship types
const legend = svg.append("g")
    .attr("transform", "translate(20, 20)");

const legendData = [
    {color: "#ff6b6b", label: "High WBC"},
    {color: "#4ecdc4", label: "Low WBC"},
    {color: "#ff9ff3", label: "Similar WBC"}
];

legendData.forEach((item, i) => {
    legend.append("line")
        .attr("x1", 0)
        .attr("y1", i * 20)
        .attr("x2", 15)
        .attr("y2", i * 20)
        .attr("stroke", item.color)
        .attr("stroke-width", 3);
    
    legend.append("text")
        .attr("x", 20)
        .attr("y", i * 20 + 4)
        .text(item.label)
        .style("font-size", "11px")
        .style("fill", "#333");
});