const API_URL = "https://nexus-ai-api-iwqr.onrender.com/api";


/*
=========================================
YA HAY SESIÓN ACTIVA — REDIRIGIR A app.html
=========================================
*/

(async function redirectIfLoggedIn() {

    const token = localStorage.getItem("nexusai_token");

    if (!token) return;

    try {

        const response = await fetch(
            `${API_URL}/auth/me`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (response.ok && data.success) {
            window.location.href = "app.html";
        } else {
            // Token inválido/expirado: lo limpiamos para
            // que no se quede intentando en cada visita.
            localStorage.removeItem("nexusai_token");
        }

    } catch (error) {
        console.error("Error verificando sesión:", error);
    }

})();

 
 
 const loginForm =
            document.getElementById("loginForm");

        const registerForm =
            document.getElementById("registerForm");


        /*
        =========================================
        CAMBIAR ENTRE LOGIN / REGISTRO
        =========================================
        */

        function showLogin() {

            registerForm.classList.remove("active");

            loginForm.classList.add("active");

        }


        function showRegister() {

            loginForm.classList.remove("active");

            registerForm.classList.add("active");

        }


        /*
        =========================================
        MOSTRAR CONTRASEÑA
        =========================================
        */

        function togglePassword(id, button) {
    const input = document.getElementById(id);
    const icon = button.querySelector("i");

    if (input.type === "password") {
        input.type = "text";

        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        input.type = "password";

        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}


        /*
        =========================================
        TOAST
        =========================================
        */

        let toastTimer;

        function showToast(message) {

            const toast =
                document.getElementById("toast");

            const messageElement =
                document.getElementById("toastMessage");

            messageElement.textContent = message;

            toast.classList.add("show");

            clearTimeout(toastTimer);

            toastTimer = setTimeout(() => {

                toast.classList.remove("show");

            }, 3000);

        }


        /*
        =========================================
        LOGIN
        =========================================
        */

        loginForm.addEventListener(
            "submit",
            async function(event) {

                event.preventDefault();

                const email =
                    document.getElementById("loginEmail").value.trim();

                const password =
                    document.getElementById("loginPassword").value;

                const remember =
                    document.getElementById("remember").checked;


                if (!email || !password) {

                    showToast(
                        "Completa todos los campos."
                    );

                    return;

                }


                const button =
                    document.getElementById("loginButton");


                button.classList.add("button-loading");

                button.innerHTML =
                    '<span class="spinner"></span>';


                try {

                    const response = await fetch(
                        `${API_URL}/auth/login`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            credentials: "include",
                            body: JSON.stringify({
                                email,
                                password,
                                remember
                            })
                        }
                    );

                    const data = await response.json();

                    if (!response.ok || !data.success) {

                        showToast(
                            data.message ||
                            "Correo o contraseña incorrectos."
                        );

                        return;

                    }

                    // Guardamos el token para enviarlo como
                    // Authorization: Bearer en cada petición
                    // (evita depender solo de la cookie cross-site).
                    localStorage.setItem(
                        "nexusai_token",
                        data.token
                    );

                    window.location.href = "app.html";

                } catch (error) {

                    console.error("Login error:", error);

                    showToast(
                        "No se pudo conectar con el servidor."
                    );

                } finally {

                    button.classList.remove("button-loading");

                    button.textContent = "Iniciar sesión";

                }

            }
        );


        /*
        =========================================
        REGISTRO
        =========================================
        */

        registerForm.addEventListener(
            "submit",
            async function(event) {

                event.preventDefault();


                const name =
                    document
                        .getElementById("registerName")
                        .value
                        .trim();


                const email =
                    document
                        .getElementById("registerEmail")
                        .value
                        .trim();


                const password =
                    document
                        .getElementById("registerPassword")
                        .value;


                const confirmPassword =
                    document
                        .getElementById("confirmPassword")
                        .value;


                if (password.length < 8) {

                    showToast(
                        "La contraseña debe tener al menos 8 caracteres."
                    );

                    return;

                }


                if (password !== confirmPassword) {

                    showToast(
                        "Las contraseñas no coinciden."
                    );

                    return;

                }


                const button =
                    document.getElementById(
                        "registerButton"
                    );


                button.classList.add(
                    "button-loading"
                );

                button.innerHTML =
                    '<span class="spinner"></span>';


                try {

                    const response = await fetch(
                        `${API_URL}/auth/register`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            credentials: "include",
                            body: JSON.stringify({
                                name,
                                email,
                                password
                            })
                        }
                    );

                    const data = await response.json();

                    if (!response.ok || !data.success) {

                        showToast(
                            data.message ||
                            "Ocurrió un error al crear la cuenta."
                        );

                        return;

                    }

                    localStorage.setItem(
                        "nexusai_token",
                        data.token
                    );

                    showToast(
                        "Cuenta creada correctamente."
                    );

                    setTimeout(() => {

                        window.location.href = "app.html";

                    }, 700);

                } catch (error) {

                    console.error("Register error:", error);

                    showToast(
                        "No se pudo conectar con el servidor."
                    );

                } finally {

                    button.classList.remove("button-loading");

                    button.textContent = "Crear cuenta";

                }

            }
        );


        /*
        =========================================
        RECUPERAR CONTRASEÑA
        =========================================
        */

        function forgotPassword() {

            showToast(
                "La recuperación de contraseña estará disponible próximamente."
            );

        }


        /*
        =========================================
        GOOGLE / GITHUB
        =========================================
        */

        function socialLogin(provider) {
            if (provider === "google") {
                window.location.href = `${API_URL}/auth/google`;
                return
            }
            showToast (
                 `Inicio de sesión con ${provider} próximamente.`,
        "error"
            );
        }