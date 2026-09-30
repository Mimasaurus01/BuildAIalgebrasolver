# Standalone Algebra Solver

This folder is the converted HTML/CSS/Python version of the Algebra Solver interface.

## Run locally

```bash
cd standalone
pip install -r requirements.txt
export MATHPIX_APP_ID="your-app-id"
export MATHPIX_APP_KEY="your-app-key"
python algebra_solver.py
```

Open `http://localhost:8000`.

- `index.html` contains the interface and browser interactions.
- `style.css` contains the visual design.
- `algebra_solver.py` serves the interface, calls Mathpix for image OCR, and solves equations with SymPy.

Text mode works without Mathpix credentials. Image mode requires `MATHPIX_APP_ID` and `MATHPIX_APP_KEY`.