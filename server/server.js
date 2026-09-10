require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const app = express();

const PORT = process.env.PORT || 3000;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "nexusai-development-secret-change-this-in-production";

const FRONTEND_URL =
    process.env.FRONTEND_URL ||
    "https://apexxxaiiii.vercel.app/";

const GOOGLE_CALLBACK_URL =
    process.env.GOOGLE_CALLBACK_URL ||
    `http://localhost:${PORT}/api/auth/google/callback`;

    const GITHUB_CALLBACK_URL =
    process.env.GITHUB_CALLBACK_URL ||
    `http://localhost:${PORT}/api/auth/github/callback`;


/* =========================================================
   DATABASE
========================================================= */

const db = new Database("nexusai.db");

db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json());

app.use(cookieParser());

app.use(express.json());

app.use(cookieParser());

const corsOptions = {
    origin: [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://apexxxaiiii.vercel.app"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

app.use(passport.initialize());


/* =========================================================
   HELPERS
========================================================= */

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}


function createToken(user, remember = false) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        JWT_SECRET,
        {
            expiresIn: remember ? "30d" : "7d"
        }
    );
}


function setAuthCookie(res, token, remember = false) {
    res.cookie("nexusai_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: (remember ? 30 : 7) * 24 * 60 * 60 * 1000
    });
}


function getSafeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at
    };
}


/* =========================================================
   GOOGLE OAUTH
========================================================= */

if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: GOOGLE_CALLBACK_URL
            },

            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email =
                        profile.emails?.[0]?.value
                            ? normalizeEmail(profile.emails[0].value)
                            : null;

                    if (!email) {
                        return done(
                            new Error(
                                "Google no proporcionó un correo electrónico."
                            )
                        );
                    }

                    const name =
                        profile.displayName ||
                        profile.name?.givenName ||
                        "Usuario de Google";


                    /* -----------------------------------------
                       Buscar usuario existente
                    ----------------------------------------- */

                    let user = db
                        .prepare(`
                            SELECT
                                id,
                                name,
                                email,
                                password_hash,
                                created_at
                            FROM users
                            WHERE email = ?
                        `)
                        .get(email);


                    /* -----------------------------------------
                       Crear usuario si no existe
                    ----------------------------------------- */

                    if (!user) {
                        const randomPassword = crypto
                            .randomBytes(32)
                            .toString("hex");

                        const passwordHash = await bcrypt.hash(
                            randomPassword,
                            12
                        );

                        const result = db
                            .prepare(`
                                INSERT INTO users (
                                    name,
                                    email,
                                    password_hash
                                )
                                VALUES (?, ?, ?)
                            `)
                            .run(
                                name,
                                email,
                                passwordHash
                            );

                        user = db
                            .prepare(`
                                SELECT
                                    id,
                                    name,
                                    email,
                                    password_hash,
                                    created_at
                                FROM users
                                WHERE id = ?
                            `)
                            .get(result.lastInsertRowid);
                    }


                    /* -----------------------------------------
                       Actualizar nombre si viene vacío
                    ----------------------------------------- */

                    if (
                        user.name === "Usuario de Google" &&
                        name
                    ) {
                        db.prepare(`
                            UPDATE users
                            SET name = ?
                            WHERE id = ?
                        `).run(name, user.id);

                        user.name = name;
                    }


                    return done(null, user);

                } catch (error) {
                    console.error(
                        "Google OAuth error:",
                        error
                    );

                    return done(error);
                }
            }
        )
    );
} else {
    console.warn(
        "⚠️ Google OAuth desactivado: faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET."
    );
}

/* =========================================================
   GITHUB OAUTH
========================================================= */

if (
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET
) {
    passport.use(
        new GitHubStrategy(
            {
                clientID: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
                callbackURL: GITHUB_CALLBACK_URL
            },

            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email =
                        profile.emails?.[0]?.value
                            ? normalizeEmail(profile.emails[0].value)
                            : null;

                    if (!email) {
                        return done(
                            new Error(
                                "GitHub no proporcionó un correo electrónico."
                            )
                        );
                    }

                    const name =
                        profile.displayName ||
                        profile.username ||
                        "Usuario de GitHub";

                    let user = db
                        .prepare(`
                            SELECT
                                id,
                                name,
                                email,
                                password_hash,
                                created_at
                            FROM users
                            WHERE email = ?
                        `)
                        .get(email);

                    if (!user) {
                        const randomPassword = crypto
                            .randomBytes(32)
                            .toString("hex");

                        const passwordHash = await bcrypt.hash(
                            randomPassword,
                            12
                        );

                        const result = db
                            .prepare(`
                                INSERT INTO users (
                                    name,
                                    email,
                                    password_hash
                                )
                                VALUES (?, ?, ?)
                            `)
                            .run(
                                name,
                                email,
                                passwordHash
                            );

                        user = db
                            .prepare(`
                                SELECT
                                    id,
                                    name,
                                    email,
                                    password_hash,
                                    created_at
                                FROM users
                                WHERE id = ?
                            `)
                            .get(result.lastInsertRowid);
                    }

                    return done(null, user);

                } catch (error) {
                    console.error(
                        "GitHub OAuth error:",
                        error
                    );

                    return done(error);
                }
            }
        )
    );
} else {
    console.warn(
        "⚠️ GitHub OAuth desactivado: faltan GITHUB_CLIENT_ID o GITHUB_CLIENT_SECRET."
    );
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "NexusAI API funcionando correctamente 🚀"
    });
});


/* =========================================================
   REGISTER
========================================================= */

app.post("/api/auth/register", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.password || "");

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "El nombre es obligatorio."
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "El correo electrónico es obligatorio."
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "La contraseña es obligatoria."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message:
                    "La contraseña debe tener al menos 8 caracteres."
            });
        }


        const existingUser = db
            .prepare(`
                SELECT id
                FROM users
                WHERE email = ?
            `)
            .get(email);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message:
                    "Ya existe una cuenta con este correo electrónico."
            });
        }


        const passwordHash = await bcrypt.hash(
            password,
            12
        );


        const result = db
            .prepare(`
                INSERT INTO users (
                    name,
                    email,
                    password_hash
                )
                VALUES (?, ?, ?)
            `)
            .run(
                name,
                email,
                passwordHash
            );


        const user = db
            .prepare(`
                SELECT
                    id,
                    name,
                    email,
                    created_at
                FROM users
                WHERE id = ?
            `)
            .get(result.lastInsertRowid);


        const token = createToken(
            user,
            false
        );

        setAuthCookie(
            res,
            token,
            false
        );


        return res.status(201).json({
            success: true,
            message: "Cuenta creada correctamente.",
            user: getSafeUser(user)
        });

    } catch (error) {
        console.error(
            "Register error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Ocurrió un error al crear la cuenta."
        });
    }
});


/* =========================================================
   LOGIN
========================================================= */

app.post("/api/auth/login", async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.password || "");
        const remember = Boolean(req.body.remember);


        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message:
                    "Introduce tu correo y contraseña."
            });
        }


        const user = db
            .prepare(`
                SELECT
                    id,
                    name,
                    email,
                    password_hash,
                    created_at
                FROM users
                WHERE email = ?
            `)
            .get(email);


        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    "Correo o contraseña incorrectos."
            });
        }


        const passwordValid =
            await bcrypt.compare(
                password,
                user.password_hash
            );


        if (!passwordValid) {
            return res.status(401).json({
                success: false,
                message:
                    "Correo o contraseña incorrectos."
            });
        }


        const token = createToken(
            user,
            remember
        );

        setAuthCookie(
            res,
            token,
            remember
        );


        return res.json({
            success: true,
            message: "Inicio de sesión correcto.",
            user: getSafeUser(user)
        });

    } catch (error) {
        console.error(
            "Login error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Ocurrió un error al iniciar sesión."
        });
    }
});


/* =========================================================
   GOOGLE LOGIN
========================================================= */

app.get(
    "/api/auth/google",
    (req, res, next) => {
        if (
            !process.env.GOOGLE_CLIENT_ID ||
            !process.env.GOOGLE_CLIENT_SECRET
        ) {
            return res.status(503).send(`
                <h1>Google OAuth no está configurado</h1>
                <p>Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el archivo .env.</p>
            `);
        }

        next();
    },

    passport.authenticate("google", {
        scope: [
            "profile",
            "email"
        ],
        session: false
    })
);


/* =========================================================
   GOOGLE CALLBACK
========================================================= */

app.get(
    "/api/auth/google/callback",

    passport.authenticate("google", {
        failureRedirect:
            `${FRONTEND_URL}/index.html`,
        session: false
    }),

    (req, res) => {
        try {
            const token = createToken(
                req.user,
                false
            );

            setAuthCookie(
                res,
                token,
                false
            );


            /*
             * Guardamos también los datos públicos
             * en la respuesta de redirección.
             *
             * La aplicación puede consultar /auth/me
             * después de cargar.
             */

            const userData = encodeURIComponent(
    JSON.stringify({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
    })
);

res.redirect(
    `${FRONTEND_URL}/app.html?token=${token}&user=${userData}`
);

        } catch (error) {
            console.error(
                "Google callback error:",
                error
            );

            res.redirect(
                `${FRONTEND_URL}/index.html`
            );
        }
    }
);

/* =========================================================
   GITHUB LOGIN
========================================================= */

app.get(
    "/api/auth/github",
    (req, res, next) => {
        if (
            !process.env.GITHUB_CLIENT_ID ||
            !process.env.GITHUB_CLIENT_SECRET
        ) {
            return res.status(503).send(`
                <h1>GitHub OAuth no está configurado</h1>
                <p>Configura GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET en Render.</p>
            `);
        }

        next();
    },

    passport.authenticate("github", {
        scope: ["user:email"],
        session: false
    })
);


/* =========================================================
   GITHUB CALLBACK
========================================================= */

app.get(
    "/api/auth/github/callback",

    passport.authenticate("github", {
        failureRedirect: `${FRONTEND_URL}/index.html`,
        session: false
    }),

    (req, res) => {
        try {
            const token = createToken(
                req.user,
                false
            );

            setAuthCookie(
                res,
                token,
                false
            );

            const userData = encodeURIComponent(
                JSON.stringify({
                    id: req.user.id,
                    name: req.user.name,
                    email: req.user.email
                })
            );

            res.redirect(
                `${FRONTEND_URL}/app.html?token=${token}&user=${userData}`
            );

        } catch (error) {
            console.error(
                "GitHub callback error:",
                error
            );

            res.redirect(
                `${FRONTEND_URL}/index.html`
            );
        }
    }
);


/* =========================================================
   CURRENT USER
========================================================= */

app.get("/api/auth/me", (req, res) => {
    try {
        const authHeader = req.headers.authorization || "";

        const bearerToken = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        const token = req.cookies.nexusai_token || bearerToken;

        // No llegó ni cookie ni Authorization
        if (!token) {
            console.log("❌ /auth/me: no llegó token (ni cookie ni Bearer)");

            return res.status(401).json({
                success: false,
                message: "No se encontró sesión."
            });
        }

        console.log("✅ /auth/me: cookie recibida");

        let decoded;

        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            console.error("❌ JWT inválido:", error.message);

            return res.status(401).json({
                success: false,
                message: "Token inválido o expirado."
            });
        }

        console.log("✅ JWT válido. User ID:", decoded.id);

        const user = db.prepare(`
            SELECT id, name, email, created_at
            FROM users
            WHERE id = ?
        `).get(decoded.id);

        if (!user) {
            console.error("❌ Usuario no encontrado:", decoded.id);

            return res.status(401).json({
                success: false,
                message: "El usuario del token no existe."
            });
        }

        console.log("✅ Usuario encontrado:", user.name, user.email);

        return res.json({
            success: true,
            user: getSafeUser(user)
        });

    } catch (error) {
        console.error("❌ ERROR /auth/me:", error);

        return res.status(500).json({
            success: false,
            message: "Error interno verificando la sesión."
        });
    }
});


/* =========================================================
   LOGOUT
========================================================= */

app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("nexusai_token", {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    });

    return res.json({
        success: true,
        message: "Sesión cerrada correctamente."
    });
});


/* =========================================================
   404
========================================================= */

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Ruta no encontrada."
    });
});


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
    console.error(
        "Server error:",
        error
    );

    res.status(500).json({
        success: false,
        message:
            "Error interno del servidor."
    });
});


/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
    console.log("");
    console.log("======================================");
    console.log("        NexusAI Authentication");
    console.log("======================================");
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(
        `❤️ Health: http://localhost:${PORT}/api/health`
    );
    console.log(
        `🔐 Google: http://localhost:${PORT}/api/auth/google`
    );
    console.log("======================================");
    console.log("");
});
