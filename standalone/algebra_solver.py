#!/usr/bin/env python3
"""Standalone HTML/CSS/Python Algebra Solver.

Run:
    pip install -r requirements.txt
    python algebra_solver.py

Then open http://localhost:8000
"""

import base64
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import requests
from sympy import Eq, factor, parse_expr, simplify, solve
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    standard_transformations,
)

try:
    from sympy.parsing.latex import parse_latex
except Exception:
    parse_latex = None


ROOT = Path(__file__).resolve().parent
TRANSFORMATIONS = standard_transformations + (
    convert_xor,
    implicit_multiplication_application,
)


def extract_latex_equation(raw_text):
    for pattern in (r"\$(.+?)\$", r"\\\[(.+?)\\\]", r"\\\((.+?)\\\)"):
        match = re.search(pattern, raw_text, re.DOTALL)
        if match:
            return match.group(1).strip()
    return raw_text.strip()


def parse_expression(value):
    cleaned = value.strip().replace("−", "-").replace("×", "*").replace("÷", "/")
    if parse_latex and ("\\" in cleaned or "{" in cleaned):
        try:
            return parse_latex(cleaned)
        except Exception:
            pass
    return parse_expr(cleaned, transformations=TRANSFORMATIONS, evaluate=True)


def parse_equation(value):
    if "=" in value:
        left, right = value.split("=", 1)
        return Eq(parse_expression(left), parse_expression(right))
    return parse_expression(value)


def pretty(value):
    return str(simplify(value))


def solve_equation(latex_value, mode, raw_text):
    equation = parse_equation(latex_value)
    variables = sorted(equation.free_symbols, key=str)
    if not variables:
        raise ValueError("No variable found. Include a variable such as x.")

    variable = variables[0]
    solutions = solve(equation, variable)
    solution_text = (
        "No solution"
        if not solutions
        else ", ".join(pretty(solution) for solution in solutions)
    )

    if isinstance(equation, Eq):
        left = simplify(equation.lhs)
        right = simplify(equation.rhs)
        difference = simplify(left - right)
        steps = [{
            "label": "Start",
            "expression": f"{pretty(left)} = {pretty(right)}",
            "detail": "Begin with the equation recognized from your input.",
        }]
        polynomial = difference.as_poly(variable)
        if difference.has(variable) and polynomial is not None:
            if polynomial.degree() == 1:
                coefficient = polynomial.coeff_monomial(variable)
                constant = polynomial.coeff_monomial(1)
                steps.extend([
                    {
                        "label": "Collect terms",
                        "expression": f"{pretty(coefficient * variable)} = {pretty(-constant)}",
                        "detail": f"Move the constant term to the other side and keep {variable} terms together.",
                    },
                    {
                        "label": "Divide by the coefficient",
                        "expression": f"{variable} = {solution_text}",
                        "detail": f"Divide both sides by {pretty(coefficient)}.",
                    },
                ])
            elif polynomial.degree() > 1:
                steps.extend([
                    {
                        "label": "Simplify",
                        "expression": f"{pretty(difference)} = 0",
                        "detail": "Move everything to one side of the equation.",
                    },
                    {
                        "label": "Factor",
                        "expression": f"{pretty(factor(difference))} = 0",
                        "detail": "Factor the polynomial to reveal the possible roots.",
                    },
                ])
        steps.append({
            "label": "Answer",
            "expression": f"{variable} = {solution_text}",
            "detail": "Substitute the solution back into the original equation to check it.",
        })
    else:
        steps = [
            {
                "label": "Expression",
                "expression": pretty(equation),
                "detail": "This expression was parsed successfully.",
            },
            {
                "label": "Answer",
                "expression": f"{variable} = {solution_text}",
                "detail": "These are the values that satisfy the expression.",
            },
        ]

    return {
        "mode": mode,
        "rawText": raw_text,
        "latex": latex_value,
        "equation": str(equation),
        "variable": str(variable),
        "solution": solution_text,
        "steps": steps,
    }


def image_to_latex(image_base64, mime_type):
    app_id = os.environ.get("MATHPIX_APP_ID")
    app_key = os.environ.get("MATHPIX_APP_KEY")
    if not app_id or not app_key:
        raise ValueError("MATHPIX_APP_ID and MATHPIX_APP_KEY are required for image mode.")

    response = requests.post(
        "https://api.mathpix.com/v3/text",
        headers={"app_id": app_id, "app_key": app_key},
        files={
            "file": (
                "equation-image",
                base64.b64decode(image_base64),
                mime_type or "image/jpeg",
            )
        },
        data={
            "options_json": json.dumps({
                "math_inline_delimiters": ["$", "$"],
                "rm_spaces": True,
            })
        },
        timeout=30,
    )
    response.raise_for_status()
    result = response.json()
    raw_text = result.get("text", "")
    if not raw_text:
        raise ValueError("Mathpix did not recognize an equation in that image.")
    return raw_text, extract_latex_equation(raw_text)


class SolverHandler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json(200, {"status": "ok"})
            return
        file_path = ROOT / ("index.html" if path in ("/", "") else path.lstrip("/"))
        if not file_path.is_file() or ROOT not in file_path.parents:
            self.send_error(404)
            return
        content_type = "text/css" if file_path.suffix == ".css" else "text/html"
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlparse(self.path).path != "/api/solve":
            self.send_json(404, {"error": "Not found."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            mode = payload.get("mode")
            if mode == "image":
                raw_text, latex_value = image_to_latex(
                    payload.get("imageBase64", ""),
                    payload.get("mimeType", "image/jpeg"),
                )
            elif mode == "text":
                raw_text = str(payload.get("equation", "")).strip()
                latex_value = raw_text
                if not latex_value:
                    raise ValueError("Enter an equation to solve.")
            else:
                raise ValueError("Choose text or image mode.")
            self.send_json(200, solve_equation(latex_value, mode, raw_text))
        except requests.RequestException as error:
            self.send_json(502, {"error": f"Mathpix request failed: {error}"})
        except Exception as error:
            self.send_json(400, {"error": str(error)})

    def log_message(self, format, *args):
        sys.stderr.write(f"[algebra-solver] {format % args}\n")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"Algebra Solver running at http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), SolverHandler).serve_forever()