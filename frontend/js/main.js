// SVG Size
let width = window.innerWidth;
let height = window.innerHeight;

// Test that D3 is working
console.log("D3 version:", d3.version);

const container = d3.select("#chart-area");

// Create SVG container
const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet");

// Handle window resizing dynamically
window.addEventListener("resize", function () {
    width = window.innerWidth;
    height = window.innerHeight;
    svg
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);
});

// Helper to clean numeric data
function parseNumeric(value) {
    if (!value) return undefined;
    const numeric = value.toString().match(/[\d.]+/);
    return numeric ? parseFloat(numeric[0]) : undefined;
}

// Load mouse dataset
d3.csv("/backend/data/Review_SY-08002944_4_3_2025 10_31_21_cleaned.csv").then(mouseData => {

    // Parse and convert values
    mouseData.forEach(d => {
        d.sampleId = d["Sample ID"];
        d.patientId = d["Patient ID"];
        d.patient = d["Patient"];

        d.wbc = parseNumeric(d["WBC (10^3/uL)"]);
        d.neutrophils = parseNumeric(d["Neu # (10^3/uL)"]);
        d.lymphocytes = parseNumeric(d["Lym # (10^3/uL)"]);
        d.monocytes = parseNumeric(d["Mon # (10^3/uL)"]);
        d.eosinophils = parseNumeric(d["Eos # (10^3/uL)"]);
        d.basophils = parseNumeric(d["Bas # (10^3/uL)"]);
        d.rbc = parseNumeric(d["RBC (10^6/uL)"]);
        d.hemoglobin = parseNumeric(d["HGB (g/dL)"]);
        d.hematocrit = parseNumeric(d["HCT (%)"]);
        d.platelets = parseNumeric(d["PLT (10^3/uL)"]);

        d.date = d["Date"];
        d.time = d["Time"];
        d.operator = d["Operator"];
        d.wbcMessage = d["WBC Message"];
        d.rbcMessage = d["RBC Message"];
        d.pltMessage = d["PLT Message"];
    });

    // Build relationships
    const relationships = [];
    const sorted = [...mouseData].sort(
        (a, b) => new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`)
    );

    // Temporal sequence
    for (let i = 0; i < sorted.length - 1; i++) {
        relationships.push({
            source: sorted[i].sampleId,
            target: sorted[i + 1].sampleId,
            type: "temporal_proximity",
            strength: 0.8
        });
    }

    // Similar WBC
    for (let i = 0; i < mouseData.length; i++) {
        for (let j = i + 1; j < mouseData.length; j++) {
            const wbcDiff = Math.abs(mouseData[i].wbc - mouseData[j].wbc);
            if (wbcDiff <= 1.0) {
                relationships.push({
                    source: mouseData[i].sampleId,
                    target: mouseData[j].sampleId,
                    type: "similar_wbc",
                    strength: 0.6
                });
            }
        }
    }

    // High WBC (leukocytosis)
    const highWbcThreshold = 12.0;
    const highWbcSamples = mouseData.filter(d => d.wbc >= highWbcThreshold);
    for (let i = 0; i < highWbcSamples.length; i++) {
        for (let j = i + 1; j < highWbcSamples.length; j++) {
            relationships.push({
                source: highWbcSamples[i].sampleId,
                target: highWbcSamples[j].sampleId,
                type: "leukocytosis_group",
                strength: 0.7
            });
        }
    }

    console.log("Mouse data:", mouseData);
    console.log("Relationships:", relationships);

    // Force simulation
    const simulation = d3.forceSimulation(mouseData)
        .force("link", d3.forceLink(relationships)
            .id(d => d.sampleId)
            .distance(d => {
                switch (d.type) {
                    case "temporal_proximity": return 100; 
                    case "leukocytosis_group": return 90;
                    case "similar_wbc": return 95;
                    default: return 110;
                }
            })
            .strength(d => d.strength || 0.45))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(45))
        .force("x", d3.forceX(width / 2).strength(0.04))
        .force("y", d3.forceY(height / 2).strength(0.04));

    window.addEventListener("resize", () => {
        simulation.force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2));
    });

    // Draw links
    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(relationships)
        .enter().append("line")
        .attr("stroke", d => {
            switch (d.type) {
                case "temporal_proximity": return "#999";
                case "leukocytosis_group": return "#ff6b6b";
                case "similar_wbc": return "#ff9ff3";
                default: return "#999";
            }
        })
        .attr("stroke-width", d => Math.sqrt(d.strength * 3))
        .attr("stroke-opacity", 0.6);

    // Draw nodes
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(mouseData)
        .enter().append("circle")
        .attr("r", 15)
        .style("fill", d => {
            if (d.wbc > 15) return "#ff4757";
            if (d.wbc > 12) return "#ff6b6b";
            if (d.wbc > 8) return "#95e1d3";
            if (d.wbc > 3) return "#4ecdc4";
            return "#2f3542";
        })
        .style("stroke", "#333")
        .style("stroke-width", 2)
        .style("cursor", "pointer")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // Node labels
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

    // Simulation tick
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

    // Drag behavior
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

    // --- SLIDE-IN PANEL LOGIC ---
    const dataPanel = d3.select("#data-panel");
    const dataContent = d3.select("#data-content");
    const closePanel = d3.select("#close-panel");

    let currentSelectedNode = null;

    closePanel.on("click", () => hidePanel());

    function hidePanel() {
        dataPanel.classed("active", false);
        if (currentSelectedNode) {
            currentSelectedNode.transition().attr("r", 15).style("stroke-width", 2);
            currentSelectedNode = null;
        }
    }

    function showPanel(d) {
        dataContent.html(createMouseTable(d));
        dataPanel.classed("active", true);
    }

    // Node click → open panel
    node.on("click", function (event, d) {
        console.log("Clicked sample:", d);

        if (dataPanel.classed("active") && currentSelectedNode === d3.select(this)) {
            hidePanel();
            return;
        }

        if (currentSelectedNode) {
            currentSelectedNode.transition().attr("r", 15).style("stroke-width", 2);
        }
        currentSelectedNode = d3.select(this);
        currentSelectedNode.transition().attr("r", 20).style("stroke-width", 4);

        showPanel(d);
    });

    // --- DATA TABLE BUILDER ---
    function createMouseTable(d) {
        let tableHTML = `
            <h3>Sample: ${d.sampleId}</h3>
            <table>
                <tr><td class="section-header" colspan="3">Blood Cell Counts</td></tr>
                <tr><td>WBC</td><td>${d.wbc}</td><td>10³/uL</td></tr>
                <tr><td>Neutrophils</td><td>${d.neutrophils}</td><td>10³/uL</td></tr>
                <tr><td>Lymphocytes</td><td>${d.lymphocytes}</td><td>10³/uL</td></tr>
                <tr><td>Monocytes</td><td>${d.monocytes}</td><td>10³/uL</td></tr>
                <tr><td>Eosinophils</td><td>${d.eosinophils}</td><td>10³/uL</td></tr>
                <tr><td>Basophils</td><td>${d.basophils}</td><td>10³/uL</td></tr>

                <tr><td class="section-header" colspan="3">Red Blood Cells</td></tr>
                <tr><td>RBC</td><td>${d.rbc}</td><td>10⁶/uL</td></tr>
                <tr><td>Hemoglobin</td><td>${d.hemoglobin}</td><td>g/dL</td></tr>
                <tr><td>Hematocrit</td><td>${d.hematocrit}</td><td>%</td></tr>
                <tr><td>Platelets</td><td>${d.platelets}</td><td>10³/uL</td></tr>

                <tr><td class="section-header" colspan="3">Sample Information</td></tr>
                <tr><td>Date</td><td>${d.date}</td><td></td></tr>
                <tr><td>Time</td><td>${d.time}</td><td></td></tr>
                <tr><td>Operator</td><td>${d.operator}</td><td></td></tr>
        `;

        if (d.wbcMessage) {
            tableHTML += `
                <tr><td class="section-header" colspan="3">Medical Notes</td></tr>
                <tr><td colspan="3" style="background:#222;">${d.wbcMessage}</td></tr>
            `;
        }

        tableHTML += `</table>`;
        return tableHTML;
    }

    // --- LEGEND ---
    const legend = svg.append("g").attr("transform", "translate(20, 20)");

    const legendData = [
        { color: "#ff6b6b", label: "High WBC" },
        { color: "#4ecdc4", label: "Low WBC" },
        { color: "#ff9ff3", label: "Similar WBC" }
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
            .style("fill", "#fff");
    });

});
