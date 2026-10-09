// Obtener elementos HTML
const pesoInput = document.getElementById("peso");
const calcularButton = document.getElementById("calcular");
const errorMensaje = document.getElementById("error");
const fluResultado = document.getElementById("flu");
const manResultado = document.getElementById("man");
const fluAzulResultado = document.getElementById("fluAzul");
const manAzulResultado = document.getElementById("manAzul");

// Función para calcular la hidratación basal
function calcularHidratacionBasal() {
    // Obtener el peso ingresado por el usuario
    const peso = parseFloat(pesoInput.value);

    // Verificar si se ingresó un peso válido
    if (isNaN(peso)) {
        errorMensaje.style.display = "block";
        fluResultado.style.display = "none";
        manResultado.style.display = "none";
        fluAzulResultado.style.display = "none";
        manAzulResultado.style.display = "none";
    } else {
        errorMensaje.style.display = "none";
        
        // Realizar los cálculos según el método seleccionado
        let volumenDiario;
        let mantenimiento;
        
        if (peso <= 10) {
            volumenDiario = peso * 100;
        } else if (peso <= 20) {
            volumenDiario = 1000 + (peso - 10) * 50;
        } else {
            volumenDiario = 1000 + 500 + (peso - 20) * 20;
        }
        
        mantenimiento = volumenDiario / 24;
        
        // Mostrar resultados en los elementos HTML
        fluResultado.textContent = `${Math.round(mantenimiento)}cc/h`;
        manResultado.textContent = `m+m/2 : ${Math.round(mantenimiento * 1.5)}cc/h`;
        fluAzulResultado.textContent = "70cc/h";
        manAzulResultado.textContent = "m+m/2 : 105cc/h";
        
        fluResultado.style.display = "block";
        manResultado.style.display = "block";
        fluAzulResultado.style.display = "block";
        manAzulResultado.style.display = "block";
    }
}

// Agregar un evento click al botón de calcular
calcularButton.addEventListener("click", calcularHidratacionBasal);