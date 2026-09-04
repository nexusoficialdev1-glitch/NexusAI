const API_URL = "http://localhost:3000/api"; 
 
 
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
            function(event) {

                event.preventDefault();

                const email =
                    document.getElementById("loginEmail").value.trim();

                const password =
                    document.getElementById("loginPassword").value;


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


                setTimeout(() => {

                    button.classList.remove(
                        "button-loading"
                    );

                    button.textContent =
                        "Iniciar sesión";


                    showToast(
                        "Inicio de sesión de demostración."
                    );

                }, 800);

            }
        );


        /*
        =========================================
        REGISTRO
        =========================================
        */

        registerForm.addEventListener(
            "submit",
            function(event) {

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


                /*
                 * DEMO
                 */

                const user = {

                    name: name,
                    email: email

                };


                localStorage.setItem(
                    "nexusai_demo_user",
                    JSON.stringify(user)
                );


                setTimeout(() => {

                    button.classList.remove(
                        "button-loading"
                    );

                    button.textContent =
                        "Crear cuenta";


                    showToast(
                        "Cuenta creada correctamente."
                    );


                    setTimeout(() => {

                        showLogin();

                        document
                            .getElementById("loginEmail")
                            .value = email;

                    }, 700);


                }, 800);

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

        