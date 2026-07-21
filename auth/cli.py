"""CLI de autenticación Fase 2.

Ejemplos:
  python -m auth.cli init-db
  python -m auth.cli login
  python -m auth.cli logout
  python -m auth.cli whoami
  python -m auth.cli change-password
  python -m auth.cli create-user --username ana --role reclutador
  python -m auth.cli revoke-user --username ana
"""

from __future__ import annotations

import argparse
import getpass
import sys

from rich.console import Console
from rich.table import Table

from .config import AuthConfig
from .models import Role, make_session_factory
from .seed import init_schema, seed_roles_and_admin
from .service import (
    AuthError,
    authenticate,
    change_password,
    clear_local_session,
    create_user,
    load_local_session_token,
    logout,
    resolve_session,
    revoke_user,
    save_local_session,
)

console = Console()


def _db_session(config: AuthConfig):
    factory, engine = make_session_factory(config.database_url)
    return factory(), engine


def cmd_init_db(config: AuthConfig) -> int:
    try:
        init_schema(config.database_url)
        db, engine = _db_session(config)
        try:
            seed_roles_and_admin(db, config)
        finally:
            db.close()
            engine.dispose()
    except Exception as error:
        console.print(f"[red]No se pudo inicializar la base:[/red] {error}")
        console.print(
            "[dim]Verifique PostgreSQL, la base 'rag_auth' y DATABASE_URL en .env[/dim]"
        )
        return 1

    console.print("[green]Esquema y roles creados.[/green]")
    console.print(f"Admin: [bold]{config.admin_username}[/bold] (contraseña de AUTH_ADMIN_PASSWORD)")
    return 0


def cmd_login(config: AuthConfig) -> int:
    username = console.input("Usuario: ").strip()
    password = getpass.getpass("Contraseña: ")
    db, engine = _db_session(config)
    try:
        ctx = authenticate(db, config, username, password)
        save_local_session(config.session_file, ctx)
        console.print(
            f"[green]Sesión iniciada[/green] como {ctx.username} ({ctx.role_label}). "
            f"Expira en {config.session_hours}h."
        )
        return 0
    except AuthError as error:
        console.print(f"[red]{error}[/red]")
        return 1
    except Exception as error:
        console.print(f"[red]Error de conexión:[/red] {error}")
        return 1
    finally:
        db.close()
        engine.dispose()


def cmd_logout(config: AuthConfig) -> int:
    token = load_local_session_token(config.session_file)
    if not token:
        clear_local_session(config.session_file)
        console.print("[yellow]No había sesión local.[/yellow]")
        return 0
    db, engine = _db_session(config)
    try:
        logout(db, token)
    except Exception:
        pass
    finally:
        db.close()
        engine.dispose()
    clear_local_session(config.session_file)
    console.print("[green]Sesión cerrada.[/green]")
    return 0


def cmd_whoami(config: AuthConfig) -> int:
    token = load_local_session_token(config.session_file)
    if not token:
        console.print("[yellow]No hay sesión. Use: python -m auth.cli login[/yellow]")
        return 1
    db, engine = _db_session(config)
    try:
        ctx = resolve_session(db, token)
    except AuthError as error:
        clear_local_session(config.session_file)
        console.print(f"[red]{error}[/red]")
        return 1
    finally:
        db.close()
        engine.dispose()

    table = Table(title="Sesión actual")
    table.add_column("Campo")
    table.add_column("Valor")
    table.add_row("Usuario", ctx.username)
    table.add_row("Rol", ctx.role_label)
    table.add_row("Tono RAG", ctx.tone_key)
    table.add_row("Admin", "sí" if ctx.is_admin else "no")
    for resource, level in ctx.permissions.items():
        table.add_row(f"Permiso:{resource}", level)
    console.print(table)
    return 0


def cmd_create_user(config: AuthConfig, username: str, role_name: str) -> int:
    token = load_local_session_token(config.session_file)
    if not token:
        console.print("[red]Debe iniciar sesión como administrador.[/red]")
        return 1

    password = getpass.getpass("Contraseña del nuevo usuario: ")
    password2 = getpass.getpass("Confirmar contraseña: ")
    if password != password2:
        console.print("[red]Las contraseñas no coinciden.[/red]")
        return 1
    if len(password) < 8:
        console.print("[red]La contraseña debe tener al menos 8 caracteres.[/red]")
        return 1

    db, engine = _db_session(config)
    try:
        admin = resolve_session(db, token)
        if not admin.is_admin:
            console.print("[red]Solo el administrador puede registrar usuarios.[/red]")
            return 1
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            names = [r.name for r in db.query(Role).order_by(Role.name).all()]
            console.print(f"[red]Rol desconocido.[/red] Opciones: {', '.join(names)}")
            return 1
        create_user(db, username=username, password=password, role_id=role.id)
        db.commit()
        console.print(f"[green]Usuario '{username}' creado con rol '{role.label}'.[/green]")
        return 0
    except AuthError as error:
        db.rollback()
        console.print(f"[red]{error}[/red]")
        return 1
    except Exception as error:
        db.rollback()
        console.print(f"[red]Error:[/red] {error}")
        return 1
    finally:
        db.close()
        engine.dispose()


def cmd_change_password(config: AuthConfig) -> int:
    token = load_local_session_token(config.session_file)
    default_user = ""
    if token:
        db_preview, engine_preview = _db_session(config)
        try:
            ctx = resolve_session(db_preview, token)
            default_user = ctx.username
        except AuthError:
            clear_local_session(config.session_file)
            token = None
        finally:
            db_preview.close()
            engine_preview.dispose()

    prompt = f"Usuario [{default_user}]: " if default_user else "Usuario: "
    username = console.input(prompt).strip() or default_user
    if not username:
        console.print("[red]Debe indicar un usuario.[/red]")
        return 1

    current = getpass.getpass("Contraseña actual: ")
    new_password = getpass.getpass("Nueva contraseña: ")
    confirm = getpass.getpass("Confirmar nueva contraseña: ")
    if new_password != confirm:
        console.print("[red]Las contraseñas nuevas no coinciden.[/red]")
        return 1

    db, engine = _db_session(config)
    try:
        change_password(
            db,
            username=username,
            current_password=current,
            new_password=new_password,
            keep_token=token if default_user == username else None,
        )
        db.commit()
        console.print(
            "[green]Contraseña actualizada.[/green] "
            "Queda solo en PostgreSQL (hash); no se guarda en .env."
        )
        if token and default_user == username:
            console.print("[dim]Su sesión actual se mantuvo; otras sesiones se cerraron.[/dim]")
        else:
            clear_local_session(config.session_file)
            console.print("[yellow]Inicie sesión de nuevo:[/yellow] python -m auth.cli login")
        return 0
    except AuthError as error:
        db.rollback()
        console.print(f"[red]{error}[/red]")
        return 1
    except Exception as error:
        db.rollback()
        console.print(f"[red]Error:[/red] {error}")
        return 1
    finally:
        db.close()
        engine.dispose()


def cmd_revoke_user(config: AuthConfig, username: str) -> int:
    token = load_local_session_token(config.session_file)
    if not token:
        console.print("[red]Debe iniciar sesión como administrador.[/red]")
        return 1
    db, engine = _db_session(config)
    try:
        admin = resolve_session(db, token)
        if not admin.is_admin:
            console.print("[red]Solo el administrador puede revocar usuarios.[/red]")
            return 1
        revoke_user(db, username)
        db.commit()
        console.print(f"[green]Usuario '{username}' revocado.[/green]")
        return 0
    except AuthError as error:
        db.rollback()
        console.print(f"[red]{error}[/red]")
        return 1
    finally:
        db.close()
        engine.dispose()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Auth Fase 2 (PostgreSQL)")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init-db", help="Crear tablas, roles y admin")
    sub.add_parser("login", help="Iniciar sesión por consola")
    sub.add_parser("logout", help="Cerrar sesión")
    sub.add_parser("whoami", help="Mostrar sesión actual")
    create = sub.add_parser("create-user", help="Registrar usuario (solo admin)")
    create.add_argument("--username", required=True)
    create.add_argument("--role", required=True, help="administrador|reclutador|cliente|estudiante|colega|general")
    revoke = sub.add_parser("revoke-user", help="Revocar usuario (solo admin)")
    revoke.add_argument("--username", required=True)
    sub.add_parser(
        "change-password",
        help="Cambiar contraseña (hash en PostgreSQL; no usa ni escribe .env)",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    config = AuthConfig()
    if args.command == "init-db":
        return cmd_init_db(config)
    if args.command == "login":
        return cmd_login(config)
    if args.command == "logout":
        return cmd_logout(config)
    if args.command == "whoami":
        return cmd_whoami(config)
    if args.command == "create-user":
        return cmd_create_user(config, args.username, args.role)
    if args.command == "revoke-user":
        return cmd_revoke_user(config, args.username)
    if args.command == "change-password":
        return cmd_change_password(config)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
