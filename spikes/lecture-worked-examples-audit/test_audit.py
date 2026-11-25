import json
import math
import unittest
from fractions import Fraction
from pathlib import Path

import audit_math as a


class IndependentReferenceTests(unittest.TestCase):
    def test_binomial_against_exact_rational_enumeration(self):
        for n in range(1, 13):
            for k in range(n + 1):
                exact = Fraction(math.comb(n, k) * 2 ** k, 3 ** n)
                self.assertAlmostEqual(float(a.binomial(n, '0.66666666666666666666666666666666666666666666666666666666666666666666666666666667', k, k)), float(exact), places=14)

    def test_occupancy_exhaustive_counts(self):
        self.assertEqual(a.empty_boxes(5), [120, 1200, 1500, 300, 5])

    def test_three_phi_functions_are_distinct(self):
        self.assertAlmostEqual(a.normal_cdf(0), .5)
        self.assertAlmostEqual(a.normal_cdf(1), .8413447460685429)
        self.assertAlmostEqual(a.phi_zero(1), .3413447460685429)
        self.assertAlmostEqual(math.erf(1), .8427007929497149)

    def test_quantiles_against_exact_special_cases(self):
        self.assertAlmostEqual(a.student_quantile(.75, 1), 1, places=10)
        self.assertAlmostEqual(a.student_quantile(.5, 21), 0, places=10)
        self.assertAlmostEqual(a.chi_quantile(.95, 2), -2 * math.log(.05), places=10)

    def test_normal_two_sided_and_poisson_tails(self):
        self.assertAlmostEqual(2 * a.normal_cdf(-3), .00269979606326019)
        self.assertAlmostEqual(a.poisson_tail(1, 4), 1 - math.exp(-1) * (1 + 1 + .5 + 1/6))

    def test_sample_uses_both_divisors(self):
        stats = a.sample_stats(['1', '2', '3'])
        self.assertEqual(stats['mean'], 2)
        self.assertAlmostEqual(stats['variance_n'], 2/3)
        self.assertEqual(stats['variance_n_minus_1'], 1)

    def test_uniform_sum_cdf_support_and_symmetry(self):
        for n in range(2, 5):
            self.assertEqual(a.uniform_sum_cdf(n, -1), 0)
            self.assertEqual(a.uniform_sum_cdf(n, n+1), 1)
            self.assertEqual(a.uniform_sum_cdf(n, Fraction(n, 2)), Fraction(1,2))
            self.assertEqual(a.uniform_sum_cdf(n, Fraction(1,3)) + a.uniform_sum_cdf(n, n-Fraction(1,3)), 1)
        self.assertEqual(a.uniform_sum_density(3, Fraction(3,2)), Fraction(3,4))
        self.assertEqual(a.uniform_sum_density(4, Fraction(3,2)), Fraction(23,48))
        self.assertEqual(a.uniform_sum_density(4, Fraction(5,2)), Fraction(23,48))

    def test_lottery_boundary_and_feasible_lp_optimum(self):
        self.assertEqual(a.lottery(1), {'n':1,'mean':1,'variance':0})
        self.assertEqual(a.lottery(4), {'n':4,'mean':1,'variance':1})
        self.assertEqual(a.lp_vertices(), {'y1':1,'y2':.5,'objective':9})

    def test_published_fixture_provenance(self):
        fixtures = json.loads((Path(__file__).parent / 'fixtures' / 'references.json').read_text(encoding='utf-8'))
        ids = [r['id'] for r in fixtures['values']]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(set(fixtures['lecture_coverage']), {f'L{i:02}' for i in range(1, 13)})
        for row in fixtures['values']:
            self.assertTrue(row['source']['pdf'].endswith('.pdf'))
            self.assertGreater(row['source']['page'], 0)
            self.assertRegex(row['source']['lines'], r'^l\d+-l\d+$')
            self.assertIn(row['phi'], ['none', 'normal_cdf', 'zero_integral', 'erf', 'mixed'])
            self.assertIn(row['verdict'], ['confirmed', 'corrected', 'approximation', 'ambiguous', 'not_a_probability'])
            if row['verdict'] == 'ambiguous':
                self.assertFalse(row['reusable'], row['id'])

    def test_all_existing_pins_have_audited_fixture_evidence(self):
        directory = Path(__file__).parent / 'fixtures'
        pins = json.loads((directory/'errata.json').read_text(encoding='utf8'))['pins']
        ids = {r['id'] for r in json.loads((directory/'references.json').read_text(encoding='utf8'))['values']}
        self.assertEqual(len(pins), 15)
        for pin in pins:
            for key in pin['fixture_ids'].split(', '):
                self.assertIn(key, ids)


if __name__ == '__main__':
    unittest.main()
