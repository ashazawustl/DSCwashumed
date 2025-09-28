// SVG Size
var width = 1000,
    height = 700;

// Test that D3 is working first
console.log("D3 version:", d3.version);

// Create SVG container
const svg = d3.select("#chart-area")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

/*All 24 mouse samples from your real data - hard coded
take the data for each field form the cleaned version of the data (done by Hans & Andrew)*/

//clean the data to include only the numerical portion for later relationship building
function parseNumeric(value) {
    if (!value) return undefined;
    const numeric = value.toString().match(/[\d.]+/);
    return numeric ? parseFloat(numeric[0]) : undefined;
}

d3.csv("/backend/data/Review_SY-08002944_4_3_2025 10_31_21_cleaned.csv").then(mouseData => {
    // Parse and convert numerical values
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

    // Temporal sequence (samples taken in chronological order)
    const relationships = [];
    const sorted = [...mouseData].sort(
        (a, b) => new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`)
    );

    for (let i = 0; i < sorted.length - 1; i++) {
        relationships.push({
            source: sorted[i].sampleId,
            target: sorted[i + 1].sampleId,
            type: "temporal_proximity",
            strength: 0.8
        });
    }

    //for WBC relationship
    for (let i = 0; i < mouseData.length; i++) {
        for (let j = i + 1; j < mouseData.length; j++) {
            const wbcDiff = Math.abs(mouseData[i].wbc - mouseData[j].wbc);
            if (wbcDiff <= 1.0) {   //threshold for "similar" WBC
                relationships.push({
                    source: mouseData[i].sampleId,
                    target: mouseData[j].sampleId,
                    type: "similar_wbc",
                    strength: 0.6
                });
            }
        }
    }

    //for higher WBC (leukocytosis)
    const highWbcThreshold = 12.0; // cutoff for leukocytosis
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
    console.log("Total samples:", mouseData.length);
    console.log("Total relationships:", relationships.length);

    // Tooltip div
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

    // Force simulation
    const simulation = d3.forceSimulation(mouseData)
        .force("link", d3.forceLink(relationships)
            .id(d => d.sampleId)
            .distance(d => {
                switch (d.type) {
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
        .force("center", d3.forceCenter(width/2, height/2))
        .force("collision", d3.forceCollide().radius(25));

    // Relationship lines
    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(relationships)
        .enter().append("line")
        .attr("stroke", d => {
            switch (d.type) {
                case "temporal_proximity": return "#999";
                case "leukocytosis_group": return "#ff6b6b";
                case "leukopenia_group": return "#4ecdc4";
                case "similar_wbc": return "#ff9ff3";
                default: return "#999";
            }
        })
        .attr("stroke-width", d => Math.sqrt(d.strength * 3))
        .attr("stroke-opacity", 0.6);

    // Sample nodes
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(mouseData)
        .enter().append("circle")
        .attr("r", 15)
        .style("fill", d => {
            if (d.wbc > 15) return "#ff4757"; // Very high WBC
            if (d.wbc > 12) return "#ff6b6b"; // High WBC
            if (d.wbc > 8) return "#95e1d3"; // Normal
            if (d.wbc > 3) return "#4ecdc4"; // Low
            return "#2f3542";                 // Very low
        })
        .style("stroke", "#333")
        .style("stroke-width", 2)
        .style("cursor", "pointer")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("mouseover", function (event, d) {
            if (currentSelectedNode !== d3.select(this)) {
                d3.select(this).transition().attr("r", 18);
            }
        })
        .on("mouseout", function (event, d) {
            if (currentSelectedNode !== d3.select(this)) {
                d3.select(this).transition().attr("r", 15);
            }
        })
        .on("click", function (event, d) {
            console.log("Clicked sample:", d);

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

    // Labels
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

    // Simulation tick update
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

    // Dragging behavior
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

    // Tooltip table
    function createMouseTable(d) {
        let tableHTML = `
            <h3 style="margin-top: 0; text-align: center; color: #fff;">Sample: ${d.sampleId}</h3>
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
            <tr><td>WBC</td><td>${d.wbc}</td><td>10³/uL</td></tr>
            <tr><td>Neutrophils</td><td>${d.neutrophils}</td><td>10³/uL</td></tr>
            <tr><td>Lymphocytes</td><td>${d.lymphocytes}</td><td>10³/uL</td></tr>
            <tr><td>Monocytes</td><td>${d.monocytes}</td><td>10³/uL</td></tr>
            <tr><td>Eosinophils</td><td>${d.eosinophils}</td><td>10³/uL</td></tr>
            <tr><td>Basophils</td><td>${d.basophils}</td><td>10³/uL</td></tr>
        `;

        // RBC
        tableHTML += `
            <tr><td colspan="3" style="background: #444; padding: 8px; font-weight: bold;">Red Blood Cells</td></tr>
            <tr><td>RBC</td><td>${d.rbc}</td><td>10⁶/uL</td></tr>
            <tr><td>Hemoglobin</td><td>${d.hemoglobin}</td><td>g/dL</td></tr>
            <tr><td>Hematocrit</td><td>${d.hematocrit}</td><td>%</td></tr>
            <tr><td>Platelets</td><td>${d.platelets}</td><td>10³/uL</td></tr>
        `;

        // Sample info
        tableHTML += `
            <tr><td colspan="3" style="background: #444; padding: 8px; font-weight: bold;">Sample Information</td></tr>
            <tr><td>Date</td><td>${d.date}</td><td></td></tr>
            <tr><td>Time</td><td>${d.time}</td><td></td></tr>
            <tr><td>Operator</td><td>${d.operator}</td><td></td></tr>
        `;

        if (d.wbcMessage) {
            tableHTML += `
                <tr><td colspan="3" style="background: #444; padding: 8px; font-weight: bold;">Medical Notes</td></tr>
                <tr><td colspan="3" style="padding: 8px; background: #333;">${d.wbcMessage}</td></tr>
            `;
        }

        tableHTML += `</table>
            <div style="margin-top: 15px; text-align: center;">
                <button onclick="hideTooltip()" style="padding: 8px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">Close</button>
            </div>
        `;

        return tableHTML;
    }

    // Tooltip functions
    window.hideTooltip = function () {
        tooltip.style("display", "none");
        tooltipVisible = false;

        if (currentSelectedNode) {
            currentSelectedNode.transition().attr("r", 15).style("stroke-width", 2);
            currentSelectedNode = null;
        }
    };

    function showTooltip(d) {
        tooltip.html(createMouseTable(d))
            .style("display", "block")
            .style("left", "80%")
            .style("top", "50%")
            .style("transform", "translate(-50%, -50%)");
        tooltipVisible = true;
    }

    // Legend
    const legend = svg.append("g")
        .attr("transform", "translate(20, 20)");

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
            .style("fill", "#333");
    });

    // Initialize graph
    initGraph(mouseData, relationships);
});
