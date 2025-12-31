document.addEventListener('DOMContentLoaded', () => {
    const gastoForm = document.getElementById('gastoForm');
    const categoriaSelect = document.getElementById('categoria');
    const montoInput = document.getElementById('monto');
    const gastosList = document.getElementById('gastosList');
    const totalesContainer = document.getElementById('totalesContainer');
    const granTotal = document.getElementById('granTotal');
    const exportarPDF = document.getElementById('exportarPDF');
    const eliminarTodos = document.getElementById('eliminarTodos');

    let gastos = JSON.parse(localStorage.getItem('gastos')) || [];
    const categorias = ['Hoteles', 'Gasoil', 'Comidas', 'Cafetería', 'Parking', 'Salones', 'Varios'];

    let pieChart = null;
    let barChart = null;

    const colores = ['#008080', '#009999', '#00b3b3', '#ADD8E6', '#87CEEB', '#FFA500', '#FF8C00'];

    // Limpiar monto al cambiar categoría
    categoriaSelect.addEventListener('change', () => {
        montoInput.value = '';
        montoInput.focus();
    });

    function renderGastos() {
        gastosList.innerHTML = '';
        if (gastos.length === 0) {
            gastosList.innerHTML = '<li style="text-align:center; color:#666;">No hay gastos registrados aún.</li>';
            return;
        }

        gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        gastos.forEach((gasto, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span><strong>${gasto.fecha}</strong> — ${gasto.categoria}: 
                <strong>${gasto.monto.toFixed(2)} €</strong>
                ${gasto.descripcion ? '<br><em>' + gasto.descripcion + '</em>' : ''}</span>
                <button onclick="eliminarGasto(${index})">✕</button>
            `;
            gastosList.appendChild(li);
        });
    }

    function calcularTotales() {
        const totales = {};
        categorias.forEach(cat => totales[cat] = 0);
        let totalGeneral = 0;

        gastos.forEach(gasto => {
            totales[gasto.categoria] += gasto.monto;
            totalGeneral += gasto.monto;
        });

        totalesContainer.innerHTML = '';
        categorias.forEach(cat => {
            if (totales[cat] > 0) {
                const p = document.createElement('p');
                p.textContent = `${cat}: ${totales[cat].toFixed(2)} €`;
                totalesContainer.appendChild(p);
            }
        });

        granTotal.textContent = `Gran Total: ${totalGeneral.toFixed(2)} €`;

        return { totales, totalGeneral };
    }

    function renderGraficos(totalesData) {
        const datos = categorias.map(cat => totalesData[cat]);
        const categoriasConGastos = categorias.filter((_, i) => datos[i] > 0);
        const datosConGastos = datos.filter(d => d > 0);

        if (pieChart) pieChart.destroy();
        if (barChart) barChart.destroy();

        // Gráfico de Dona (mejor que pie)
        pieChart = new Chart(document.getElementById('pieChart'), {
            type: 'doughnut',
            data: {
                labels: categoriasConGastos,
                datasets: [{
                    data: datosConGastos,
                    backgroundColor: colores,
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverOffset: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 20, font: { size: 14 } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const val = ctx.parsed;
                                const sum = ctx.dataset.data.reduce((a,b) => a+b, 0);
                                const perc = ((val/sum)*100).toFixed(1);
                                return `${ctx.label}: ${val.toFixed(2)} € (${perc}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Barras horizontales elegantes
        barChart = new Chart(document.getElementById('barChart'), {
            type: 'bar',
            data: {
                labels: categoriasConGastos,
                datasets: [{
                    label: 'Gastos (€)',
                    data: datosConGastos,
                    backgroundColor: '#008080',
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `${ctx.parsed.x.toFixed(2)} €` } }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { callback: v => v + ' €' } },
                    y: { grid: { display: false } }
                },
                animation: { duration: 1500 }
            }
        });
    }

    gastoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const monto = parseFloat(montoInput.value);
        if (monto <= 0) return alert('Introduce un monto válido');

        gastos.push({
            fecha: document.getElementById('fecha').value,
            categoria: categoriaSelect.value,
            monto: monto,
            descripcion: document.getElementById('descripcion').value.trim()
        });

        localStorage.setItem('gastos', JSON.stringify(gastos));
        renderGastos();
        const { totales } = calcularTotales();
        renderGraficos(totales);
        gastoForm.reset();
        document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
    });

    window.eliminarGasto = function(index) {
        gastos.splice(index, 1);
        localStorage.setItem('gastos', JSON.stringify(gastos));
        renderGastos();
        const { totales } = calcularTotales();
        renderGraficos(totales);
    };

    eliminarTodos.addEventListener('click', () => {
        if (confirm('¿Eliminar TODOS los gastos? Esta acción es irreversible.')) {
            gastos = [];
            localStorage.removeItem('gastos');
            renderGastos();
            const { totales } = calcularTotales();
            renderGraficos(totales);
        }
    });

    // PDF mejorado con tabla
    exportarPDF.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        doc.setFontSize(20);
        doc.text('Agenda de Gastos', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 105, 30, { align: 'center' });

        const filas = gastos.map(g => [
            g.fecha,
            g.categoria,
            g.monto.toFixed(2) + ' €',
            g.descripcion || '-'
        ]);

        doc.autoTable({
            head: [['Fecha', 'Categoría', 'Monto', 'Descripción']],
            body: filas,
            startY: 40,
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [0, 128, 128] }
        });

        const finalY = doc.lastAutoTable.finalY || 40;
        doc.setFontSize(14);
        doc.text('Totales:', 14, finalY + 15);
        
        let y = finalY + 25;
        const { totales, totalGeneral } = calcularTotales();
        categorias.forEach(cat => {
            if (totales[cat] > 0) {
                doc.text(`${cat}: ${totales[cat].toFixed(2)} €`, 20, y);
                y += 8;
            }
        });
        doc.setFontSize(18);
        doc.setTextColor(255, 165, 0);
        doc.text(`Gran Total: ${totalGeneral.toFixed(2)} €`, 105, y + 10, { align: 'center' });

        doc.save('agenda-gastos.pdf');
    });

    // Inicializar
    document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
    renderGastos();
    const { totales } = calcularTotales();
    renderGraficos(totales);
});