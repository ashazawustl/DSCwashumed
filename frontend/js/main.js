// --- SVG SETUP ---
const container = d3.select("#chart-area");

// Get the actual chart area dimensions
const chartArea = document.getElementById("chart-area");
let width = chartArea.clientWidth;
let height = chartArea.clientHeight;

const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet");

window.addEventListener("resize", () => {
    width = chartArea.clientWidth;
    height = chartArea.clientHeight;
    svg.attr("width", width).attr("height", height).attr("viewBox", [0, 0, width, height]);
});

// --- HELPERS ---
function parseNumeric(value) {
    if (!value) return undefined;
    const numeric = value.toString().match(/[\d.]+/);
    return numeric ? parseFloat(numeric[0]) : undefined;
}

// --- LOAD DATA ---
d3.csv("/backend/data/Review_SY-08002944_4_3_2025 10_31_21_cleaned.csv").then(mouseData => {

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
        d.gender = d["Gender"]; // Capture gender field
        // DEXA values (future-ready)
        d.total_weight = parseNumeric(d["total_weight"]);
        d.soft_weight = parseNumeric(d["soft_weight"]);
        d.lean_weight = parseNumeric(d["lean_weight"]);
        d.fat_weight = parseNumeric(d["fat_weight"]);
        d.fat_percent = parseNumeric(d["fat_percent"]);
    });

    const metrics = [
        "wbc", "neutrophils", "lymphocytes", "monocytes", "eosinophils",
        "basophils", "rbc", "hemoglobin", "hematocrit", "platelets"
    ];

    // --- RELATIONSHIPS ---
    const relationships = [];
    const sorted = [...mouseData].sort((a, b) => new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`));

    // Temporal links (sequence order)
    for (let i = 0; i < sorted.length - 1; i++) {
        relationships.push({
            source: sorted[i].sampleId,
            target: sorted[i + 1].sampleId,
            type: "temporal",
            strength: 0.8
        });
    }

    // Metric-based similarity links
    const threshold = 1.0;
    for (let i = 0; i < mouseData.length; i++) {
        for (let j = i + 1; j < mouseData.length; j++) {
            for (const metric of metrics) {
                const a = mouseData[i][metric];
                const b = mouseData[j][metric];
                if (a != null && b != null && Math.abs(a - b) <= threshold) {
                    relationships.push({
                        source: mouseData[i].sampleId,
                        target: mouseData[j].sampleId,
                        type: `similar_${metric}`,
                        strength: 0.4
                    });
                }
            }
        }
    }

    // --- GROUP COLORS (matching your theme) ---
    const groupColors = d3.scaleOrdinal()
        .domain(['group1', 'group2', 'group3', 'group4', 'group5', 'group6', 'ungrouped'])
        .range(['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#95a5a6']);

    // --- ADAPTIVE FORCE SIMULATION ---
    function getForceSettings(nodeCount) {
        if (nodeCount < 20) return { charge: -250, distance: 180, collide: 50 };
        if (nodeCount < 50) return { charge: -200, distance: 140, collide: 40 };
        if (nodeCount < 100) return { charge: -160, distance: 120, collide: 35 };
        if (nodeCount < 200) return { charge: -120, distance: 100, collide: 30 };
        return { charge: -90, distance: 85, collide: 25 };
    }

    function createSimulation(nodesData, linksData, groupCenters = null) {
        const settings = getForceSettings(nodesData.length);

        const linkForce = d3.forceLink()
            .id(d => d.sampleId)
            .distance(() => settings.distance)
            .strength(d => d.strength || 0.6);

        // Add boundary padding to keep nodes visible
        const padding = 60;
        const centerY = (height / 2); // Shift center up to prevent bottom cutoff

        const sim = d3.forceSimulation(nodesData)
            .force("link", linkForce)
            .force("charge", d3.forceManyBody().strength(settings.charge))
            .force("collision", d3.forceCollide().radius(settings.collide));

        // If grouping is active, use cluster centers with stronger force
        if (groupCenters && Object.keys(groupCenters).length > 0) {
            sim.force("cluster", forceCluster(groupCenters));
            sim.force("center", null);
            // Stronger positioning forces for grouped nodes
            sim.force("x", d3.forceX(d => {
                if (d.group && groupCenters[d.group]) {
                    return groupCenters[d.group].x;
                }
                return width / 2;
            }).strength(0.15));
            sim.force("y", d3.forceY(d => {
                if (d.group && groupCenters[d.group]) {
                    return groupCenters[d.group].y;
                }
                return centerY;
            }).strength(0.15));
        } else {
            sim.force("center", d3.forceCenter(width / 2, centerY));
            sim.force("cluster", null);
            sim.force("x", d3.forceX(width / 2).strength(0.05));
            sim.force("y", d3.forceY(centerY).strength(0.05));
        }

        // Add boundary force to keep nodes within viewport
        sim.force("boundary", () => {
            for (let node of nodesData) {
                node.x = Math.max(padding, Math.min(width - padding, node.x));
                node.y = Math.max(padding, Math.min(height - padding, node.y));
            }
        });

        if (linksData && linksData.length) linkForce.links(linksData);
        return sim;
    }

    // Custom force to cluster nodes by group with stronger attraction
    function forceCluster(centers) {
        const strength = 0.5; // Increased for better clustering
        let nodes;

        function force(alpha) {
            for (const node of nodes) {
                if (node.group && centers[node.group]) {
                    const center = centers[node.group];
                    node.vx += (center.x - node.x) * strength * alpha;
                    node.vy += (center.y - node.y) * strength * alpha;
                }
            }
        }

        force.initialize = function (_) {
            nodes = _;
        };

        return force;
    }

    // Calculate cluster centers with better spacing
    function calculateGroupCenters(groups) {
        const centers = {};
        const groupList = Object.keys(groups).filter(g => groups[g].length > 0);
        const numGroups = groupList.length;

        if (numGroups === 0) return {};

        // Margins based on actual chart area
        const margin = 100;
        const topMargin = 100;
        const bottomMargin = 80; // Extra margin from bottom
        const usableWidth = width - (2 * margin);
        const usableHeight = height - topMargin - bottomMargin;

        if (numGroups === 1) {
            // Single group in center, shifted up
            centers[groupList[0]] = {
                x: width / 2,
                y: topMargin + (usableHeight / 2) - 20
            };
        } else if (numGroups === 2) {
            // Two groups side by side
            const spacing = usableWidth / 3;
            const centerY = topMargin + (usableHeight / 2) - 20;
            centers[groupList[0]] = {
                x: margin + spacing,
                y: centerY
            };
            centers[groupList[1]] = {
                x: margin + spacing * 2,
                y: centerY
            };
        } else if (numGroups <= 4) {
            // Circular arrangement with controlled radius
            const radius = Math.min(usableWidth, usableHeight) * 0.32;
            const angleStep = (2 * Math.PI) / numGroups;
            const centerX = width / 2;
            const centerY = topMargin + (usableHeight / 2) - 20;

            groupList.forEach((group, i) => {
                const angle = i * angleStep - Math.PI / 2;
                centers[group] = {
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
                };
            });
        } else {
            // Grid arrangement for many groups
            const cols = Math.ceil(Math.sqrt(numGroups));
            const rows = Math.ceil(numGroups / cols);
            const xSpacing = usableWidth / (cols + 1);
            const ySpacing = usableHeight / (rows + 1);

            groupList.forEach((group, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                centers[group] = {
                    x: margin + xSpacing * (col + 1),
                    y: topMargin + ySpacing * (row + 1)
                };
            });
        }

        return centers;
    }

    // --- SVG GROUPS ---
    const linkGroup = svg.append("g").attr("class", "links");
    const groupHullsGroup = svg.append("g").attr("class", "group-hulls");
    const nodeGroup = svg.append("g").attr("class", "nodes");
    const labelGroup = svg.append("g").attr("class", "labels");
    const clusterLabelGroup = svg.append("g").attr("class", "cluster-labels");

    const originalNodes = mouseData.map(d => ({ ...d }));
    const originalLinks = relationships.map(d => ({ ...d }));

    let simulation = createSimulation(mouseData, relationships);
    let currentGroups = {};
    let currentGroupCenters = {};

    // --- ADD LEGEND ---
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(20, 20)");

    // Legend background
    legend.append("rect")
        .attr("width", 220)
        .attr("height", 220)
        .attr("fill", "rgba(0, 0, 0, 0.8)")
        .attr("rx", 8);

    // Legend title
    legend.append("text")
        .attr("x", 10)
        .attr("y", 20)
        .style("fill", "#fff")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text("Legend");

    // Operator colors
    legend.append("text")
        .attr("x", 10)
        .attr("y", 45)
        .style("fill", "#81e0e9")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .text("Operator (Bioreplicate):");

    legend.append("circle")
        .attr("cx", 20)
        .attr("cy", 60)
        .attr("r", 8)
        .attr("fill", "#3C948B");
    legend.append("text")
        .attr("x", 35)
        .attr("y", 65)
        .style("fill", "#fff")
        .style("font-size", "11px")
        .text("Schuettpelz");

    legend.append("circle")
        .attr("cx", 20)
        .attr("cy", 80)
        .attr("r", 8)
        .attr("fill", "#9b59b6");
    legend.append("text")
        .attr("x", 35)
        .attr("y", 85)
        .style("fill", "#fff")
        .style("font-size", "11px")
        .text("Magee");

    // WBC status (stroke colors)
    legend.append("text")
        .attr("x", 10)
        .attr("y", 105)
        .style("fill", "#81e0e9")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .text("WBC Status (Ring):");

    const wbcStatuses = [
        { label: "Normal (≤8)", color: "#4CAF50", y: 120 },
        { label: "Normal-High (8-12)", color: "#FFA500", y: 135 },
        { label: "High (12-15)", color: "#ff6b6b", y: 150 },
        { label: "Very High (>15)", color: "#ff4757", y: 165 }
    ];

    wbcStatuses.forEach(status => {
        legend.append("circle")
            .attr("cx", 20)
            .attr("cy", status.y)
            .attr("r", 8)
            .attr("fill", "none")
            .attr("stroke", status.color)
            .attr("stroke-width", 3);
        legend.append("text")
            .attr("x", 35)
            .attr("y", status.y + 4)
            .style("fill", "#fff")
            .style("font-size", "10px")
            .text(status.label);
    });

    // Size subtitle and examples
    legend.append("text")
        .attr("x", 10)
        .attr("y", 185)
        .style("fill", "#81e0e9")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .text("Size (Gender):");

    legend.append("circle")
        .attr("cx", 20)
        .attr("cy", 200)
        .attr("r", 12)
        .attr("fill", "#555")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);
    legend.append("text")
        .attr("x", 38)
        .attr("y", 205)
        .style("fill", "#fff")
        .style("font-size", "10px")
        .text("Male (larger)");

    legend.append("circle")
        .attr("cx", 130)
        .attr("cy", 200)
        .attr("r", 9)
        .attr("fill", "#555")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);
    legend.append("text")
        .attr("x", 145)
        .attr("y", 205)
        .style("fill", "#fff")
        .style("font-size", "10px")
        .text("Female");

    updateGraph(originalNodes, []);

    // --- PANEL HANDLING ---
    const dataPanel = d3.select("#data-panel");
    const dataContent = d3.select("#data-content");
    const closePanel = d3.select("#close-panel");
    let currentSelectedNode = null;

    closePanel.on("click", hidePanel);
    function hidePanel() {
        dataPanel.classed("active", false);
        if (currentSelectedNode) {
            currentSelectedNode.transition().attr("r", 20).style("stroke-width", 2);
            currentSelectedNode = null;
        }
    }

    function showPanel(d, nodeSel) {
        dataContent.html(createMouseTable(d));
        dataPanel.classed("active", true);
        if (currentSelectedNode && currentSelectedNode.node() !== nodeSel.node()) {
            currentSelectedNode.transition().attr("r", 20).style("stroke-width", 2);
        }
        currentSelectedNode = nodeSel;
        nodeSel.transition().attr("r", 26).style("stroke-width", 4);
    }

    // --- UPDATE GRAPH ---
    function updateGraph(nodesData, linksData, metric = null, groupCenters = null) {
        linkGroup.selectAll("line").remove();
        groupHullsGroup.selectAll("path").remove();
        nodeGroup.selectAll("circle").remove();
        labelGroup.selectAll("text").remove();
        clusterLabelGroup.selectAll("*").remove();

        // Filter only nodes with groups for hull drawing
        const groupedNodes = nodesData.filter(d => d.group);
        
        // Draw convex hulls for each group
        if (groupedNodes.length > 0) {
            const groupedByGroup = d3.group(groupedNodes, d => d.group);
            
            groupedByGroup.forEach((nodes, groupName) => {
                if (nodes.length >= 3) {
                    // We'll update hull after simulation settles
                    groupHullsGroup.append("path")
                        .datum({group: groupName, nodes: nodes})
                        .attr("class", `hull-${groupName}`)
                        .attr("fill", groupColors(groupName))
                        .attr("fill-opacity", 0.15)
                        .attr("stroke", groupColors(groupName))
                        .attr("stroke-width", 3)
                        .attr("stroke-dasharray", "5,5");
                }
            });
        }

        const link = linkGroup.selectAll("line")
            .data(linksData, d => `${d.source}-${d.target}`)
            .join("line")
            .attr("stroke", d => d.color || "#aaa")
            .attr("stroke-width", d => metric ? 2 - (d.diff * 0.1) : 0.8)
            .attr("opacity", d => metric ? 0.8 : 0.3);

        const node = nodeGroup.selectAll("circle")
            .data(nodesData, d => d.sampleId)
            .join("circle")
            .attr("r", d => {
                // Size based on gender (future-ready)
                if (d.gender && d.gender.toLowerCase() === 'male') return 24;
                if (d.gender && d.gender.toLowerCase() === 'female') return 18;
                return 20; // Default size when gender is not specified
            })
            .attr("fill", d => {
                // Main node color based on operator (bioreplicate)
                if (metric) {
                    // When filtering, still use metric-based coloring
                    const val = d[metric];
                    if (val == null) return "#ccc";
                    const range = d3.extent(nodesData, n => n[metric]);
                    const scale = d3.scaleSequential(d3.interpolateViridis).domain(range.reverse());
                    return scale(val);
                }
                // Color by operator (bioreplicate)
                if (d.operator === "Schuettpelz") return "#3C948B"; // Teal
                if (d.operator === "Magee") return "#9b59b6";       // Purple
                return "#81e0e9"; // Light blue default
            })
            .attr("stroke", d => {
                // Outer ring color based on WBC value (if grouped, show group color)
                if (d.group) return groupColors(d.group);
                
                // WBC-based stroke color
                if (d.wbc > 15) return "#ff4757";      // Red
                if (d.wbc > 12) return "#ff6b6b";      // Light red
                if (d.wbc > 8) return "#FFA500";       // Orange
                return "#4CAF50";                       // Green
            })
            .attr("stroke-width", d => d.group ? 4 : 3)
            .style("cursor", "pointer")
            .on("click", function (event, d) {
                showPanel(d, d3.select(this));
            })
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        const label = labelGroup.selectAll("text")
            .data(nodesData, d => d.sampleId)
            .join("text")
            .attr("text-anchor", "middle")
            .attr("dy", 5)
            .text(d => d.sampleId)
            .style("fill", "#fff")
            .style("font-size", "13px")
            .style("font-weight", "600")
            .style("pointer-events", "none")
            .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.8)");

        // Add cluster labels with backgrounds if grouping is active
        if (groupCenters && Object.keys(groupCenters).length > 0) {
            Object.entries(groupCenters).forEach(([groupName, center]) => {
                // Background rectangle
                const labelText = groupName.toUpperCase();
                const bbox = {width: labelText.length * 14, height: 28};
                
                clusterLabelGroup.append("rect")
                    .attr("x", center.x - bbox.width / 2)
                    .attr("y", center.y - 120)
                    .attr("width", bbox.width)
                    .attr("height", bbox.height)
                    .attr("rx", 5)
                    .attr("fill", groupColors(groupName))
                    .attr("fill-opacity", 0.9)
                    .attr("stroke", "#000")
                    .attr("stroke-width", 2);

                clusterLabelGroup.append("text")
                    .attr("x", center.x)
                    .attr("y", center.y - 100)
                    .attr("text-anchor", "middle")
                    .style("font-size", "20px")
                    .style("font-weight", "bold")
                    .style("fill", "#fff")
                    .style("text-shadow", "2px 2px 4px rgba(0,0,0,0.8)")
                    .text(labelText);
            });
        }

        simulation.stop();
        simulation = createSimulation(nodesData, linksData, groupCenters);
        simulation.alpha(1).restart();

        // Update hulls function
        function updateHulls() {
            groupHullsGroup.selectAll("path").attr("d", d => {
                const points = d.nodes.map(n => [n.x, n.y]);
                if (points.length < 3) return null;
                return roundedHull(points, 40);
            });
        }

        simulation.on("tick", () => {
            if (linksData && linksData.length) {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);
            }
            node.attr("cx", d => d.x).attr("cy", d => d.y);
            label.attr("x", d => d.x).attr("y", d => d.y);
            updateHulls();
        });
    }

    // Helper function to create rounded convex hull
    function roundedHull(points, padding) {
        // Get convex hull
        const hull = d3.polygonHull(points);
        if (!hull || hull.length < 3) return null;

        // Expand hull outward by padding
        const centroid = d3.polygonCentroid(hull);
        const expanded = hull.map(p => {
            const dx = p[0] - centroid[0];
            const dy = p[1] - centroid[1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            return [
                p[0] + (dx / dist) * padding,
                p[1] + (dy / dist) * padding
            ];
        });

        // Create smooth curve
        return "M" + expanded.map((p, i) => {
            const next = expanded[(i + 1) % expanded.length];
            return `${p[0]},${p[1]} L${next[0]},${next[1]}`;
        }).join(" ") + "Z";
    }

    // --- DRAG FUNCTIONS ---
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) {
        d.fx = event.x; d.fy = event.y;
    }
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }

    // --- DATA TABLE ---
    function createMouseTable(d) {
        let groupInfo = '';
        if (d.group) {
            groupInfo = `<tr><td class="section-header" colspan="3" style="background-color: ${groupColors(d.group)}; color: white;">Group: ${d.group.toUpperCase()}</td></tr>`;
        }
        
        // Determine WBC status for display
        let wbcStatus = 'Normal';
        let wbcColor = '#4CAF50';
        if (d.wbc > 15) { wbcStatus = 'Very High'; wbcColor = '#ff4757'; }
        else if (d.wbc > 12) { wbcStatus = 'High'; wbcColor = '#ff6b6b'; }
        else if (d.wbc > 8) { wbcStatus = 'Normal-High'; wbcColor = '#FFA500'; }
        
        return `
        <h3>Sample: ${d.sampleId}</h3>
        <table>
            ${groupInfo}
            <tr><td class="section-header" colspan="3">Sample Classification</td></tr>
            <tr><td>Operator</td><td colspan="2">${d.operator || 'N/A'}</td></tr>
            <tr><td>Gender</td><td colspan="2">${d.gender || 'Not specified'}</td></tr>
            <tr><td>WBC Status</td><td colspan="2" style="color: ${wbcColor}; font-weight: bold;">${wbcStatus}</td></tr>
            <tr><td class="section-header" colspan="3">DEXA Values</td></tr>
            <tr><td>Total Weight</td><td>${d.total_weight || 'Not specified'}</td><td>g</td></tr>
            <tr><td>Soft Weight</td><td>${d.soft_weight || 'Not specified'}</td><td>g</td></tr>
            <tr><td>Lean Weight</td><td>${d.lean_weight || 'Not specified'}</td><td>g</td></tr>
            <tr><td>Fat Weight</td><td>${d.fat_weight || 'Not specified'}</td><td>g</td></tr>
            <tr><td>Fat Percent</td><td>${d.fat_percent || 'Not specified'}</td><td>%</td></tr>
            <tr><td class="section-header" colspan="3">Blood Cell Counts</td></tr>
            <tr><td>WBC</td><td>${d.wbc || 'N/A'}</td><td>10³/uL</td></tr>
            <tr><td>Neutrophils</td><td>${d.neutrophils || 'N/A'}</td><td>10³/uL</td></tr>
            <tr><td>Lymphocytes</td><td>${d.lymphocytes || 'N/A'}</td><td>10³/uL</td></tr>
            <tr><td>Monocytes</td><td>${d.monocytes || 'N/A'}</td><td>10³/uL</td></tr>
            <tr><td>Eosinophils</td><td>${d.eosinophils || 'N/A'}</td><td>10³/uL</td></tr>
            <tr><td>Basophils</td><td>${d.basophils || 'N/A'}</td><td>10³/uL</td></tr>
            <tr><td class="section-header" colspan="3">Red Blood Cells</td></tr>
            <tr><td>RBC</td><td>${d.rbc || 'N/A'}</td><td>10⁶/uL</td></tr>
            <tr><td>Hemoglobin</td><td>${d.hemoglobin || 'N/A'}</td><td>g/dL</td></tr>
            <tr><td>Hematocrit</td><td>${d.hematocrit || 'N/A'}</td><td>%</td></tr>
            <tr><td>Platelets</td><td>${d.platelets || 'N/A'}</td><td>10³/uL</td></tr>
            <tr><td class="section-header" colspan="3">Sample Info</td></tr>
            <tr><td>Date</td><td colspan="2">${d.date || 'N/A'}</td></tr>
            <tr><td>Time</td><td colspan="2">${d.time || 'N/A'}</td></tr>
        </table>`;
    }

    // --- FILTERING ---
    const filterType = document.getElementById("filterType");
    const filterMin = document.getElementById("filterMin");
    const filterMax = document.getElementById("filterMax");
    const applyFilterBtn = document.getElementById("applyFilterBtn");
    const resetFilterBtn = document.getElementById("resetFilterBtn");

    function applyFilter() {
        const metric = filterType.value;
        const minVal = parseFloat(filterMin.value);
        const maxVal = parseFloat(filterMax.value);

        if (metric === "all" || (isNaN(minVal) && isNaN(maxVal))) {
            resetFilter();
            return;
        }

        const filteredNodes = originalNodes.filter(d => {
            const val = d[metric];
            if (val == null) return false;
            if (!isNaN(minVal) && val < minVal) return false;
            if (!isNaN(maxVal) && val > maxVal) return false;
            return true;
        });

        const filteredLinks = [];
        const proximityThreshold = d3.max(filteredNodes, d => d[metric]) - d3.min(filteredNodes, d => d[metric]);
        const colorScale = d3.scaleSequential(d3.interpolateRdYlBu).domain([0, proximityThreshold]);

        for (let i = 0; i < filteredNodes.length; i++) {
            for (let j = i + 1; j < filteredNodes.length; j++) {
                const a = filteredNodes[i][metric];
                const b = filteredNodes[j][metric];
                if (a != null && b != null) {
                    const diff = Math.abs(a - b);
                    filteredLinks.push({
                        source: filteredNodes[i].sampleId,
                        target: filteredNodes[j].sampleId,
                        diff,
                        color: colorScale(diff),
                        strength: 1 - (diff / proximityThreshold)
                    });
                }
            }
        }

        updateGraph(filteredNodes, filteredLinks, metric);
    }

    function resetFilter() {
        filterType.value = "all";
        filterMin.value = "";
        filterMax.value = "";
        // Clear groups when resetting
        originalNodes.forEach(d => delete d.group);
        currentGroups = {};
        currentGroupCenters = {};
        updateGraph(originalNodes, []);
    }

    applyFilterBtn.addEventListener("click", applyFilter);
    resetFilterBtn.addEventListener("click", resetFilter);

    // --- GROUPING FUNCTIONALITY ---
    const groupMetric = document.getElementById("groupMetric");
    const addGroupBtn = document.getElementById("addGroupBtn");
    const clearGroupsBtn = document.getElementById("clearGroupsBtn");
    const groupRangesContainer = document.getElementById("groupRanges");

    let groupCounter = 1;
    let currentGroupingMetric = null;

    function updateGroupMetricState() {
        if (groupRangesContainer.children.length > 0) {
            groupMetric.disabled = true;
            groupMetric.style.opacity = "0.5";
            groupMetric.style.cursor = "not-allowed";
        } else {
            groupMetric.disabled = false;
            groupMetric.style.opacity = "1";
            groupMetric.style.cursor = "pointer";
            currentGroupingMetric = null;
        }
    }

    addGroupBtn.addEventListener("click", () => {
        const selectedMetric = groupMetric.value;
        
        if (selectedMetric === "all") {
            alert("Please select a metric for grouping first");
            return;
        }

        if (groupRangesContainer.children.length === 0) {
            currentGroupingMetric = selectedMetric;
        }

        const groupDiv = document.createElement("div");
        groupDiv.className = "group-range-input";

        const groupName = `group${groupCounter}`;
        const color = groupColors(groupName);

        groupDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="display: inline-block; width: 15px; height: 15px; background: ${color}; border-radius: 50%; border: 2px solid #333;"></span>
                <strong style="color: ${color};">Group ${groupCounter}</strong>
                <span style="color: #81e0e9;">(${currentGroupingMetric})</span>
                <label>Min: <input type="number" class="group-min" step="0.1" style="width: 80px;"></label>
                <label>Max: <input type="number" class="group-max" step="0.1" style="width: 80px;"></label>
                <button class="remove-group-btn">Remove</button>
            </div>
        `;

        groupDiv.querySelector(".remove-group-btn").addEventListener("click", () => {
            groupDiv.remove();
            updateGroupMetricState();
        });

        groupRangesContainer.appendChild(groupDiv);
        groupCounter++;
        updateGroupMetricState();
    });

    const applyGroupingBtn = document.getElementById("applyGroupingBtn");
    applyGroupingBtn.addEventListener("click", () => {
        if (!currentGroupingMetric || currentGroupingMetric === "all") {
            alert("Please add at least one group first");
            return;
        }

        const metric = currentGroupingMetric;

        // Clear previous groups
        originalNodes.forEach(d => delete d.group);
        currentGroups = {};

        // Get all group range inputs
        const groupInputs = groupRangesContainer.querySelectorAll(".group-range-input");
        
        groupInputs.forEach((groupDiv, index) => {
            const minInput = groupDiv.querySelector(".group-min");
            const maxInput = groupDiv.querySelector(".group-max");
            const minVal = parseFloat(minInput.value);
            const maxVal = parseFloat(maxInput.value);

            if (isNaN(minVal) && isNaN(maxVal)) return;

            const groupName = `group${index + 1}`;
            currentGroups[groupName] = [];

            // Assign nodes to this group
            originalNodes.forEach(d => {
                const val = d[metric];
                if (val == null) return;
                
                // Check if value falls within this group's range
                const meetsMin = isNaN(minVal) || val >= minVal;
                const meetsMax = isNaN(maxVal) || val <= maxVal;
                
                if (meetsMin && meetsMax && !d.group) {
                    d.group = groupName;
                    currentGroups[groupName].push(d);
                }
            });
        });

        // Remove empty groups
        Object.keys(currentGroups).forEach(key => {
            if (currentGroups[key].length === 0) {
                delete currentGroups[key];
            }
        });

        // Calculate cluster centers
        currentGroupCenters = calculateGroupCenters(currentGroups);

        console.log("Groups created:", currentGroups);
        console.log("Nodes per group:", Object.entries(currentGroups).map(([k, v]) => `${k}: ${v.length}`));
        console.log("Group centers:", currentGroupCenters);

        // Update graph with grouping
        updateGraph(originalNodes, [], null, currentGroupCenters);
    });

    clearGroupsBtn.addEventListener("click", () => {
        groupRangesContainer.innerHTML = "";
        groupCounter = 1;
        currentGroupingMetric = null;
        originalNodes.forEach(d => delete d.group);
        currentGroups = {};
        currentGroupCenters = {};
        updateGroupMetricState();
        updateGraph(originalNodes, []);
    });

    updateGroupMetricState();

});