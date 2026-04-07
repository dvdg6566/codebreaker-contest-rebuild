#include <bits/stdc++.h>
//#include "includeall.h"
//#include <ext/pb_ds/assoc_container.hpp>
//#include <ext/pb_ds/tree_policy.hpp>
#define endl '\n'
#define f first
#define s second
#define pb push_back
#define mp make_pair
#define lb lower_bound
#define ub upper_bound
#define input(x) scanf("%lld", &x);
#define input2(x, y) scanf("%lld%lld", &x, &y);
#define input3(x, y, z) scanf("%lld%lld%lld", &x, &y, &z);
#define input4(x, y, z, a) scanf("%lld%lld%lld%lld", &x, &y, &z, &a);
#define print(x, y) printf("%lld%c", x, y);
#define show(x) cerr << #x << " is " << x << endl;
#define show2(x,y) cerr << #x << " is " << x << " " << #y << " is " << y << endl;
#define show3(x,y,z) cerr << #x << " is " << x << " " << #y << " is " << y << " " << #z << " is " << z << endl;
#define all(x) x.begin(), x.end()
#define discretize(x) sort(x.begin(), x.end()); x.erase(unique(x.begin(), x.end()), x.end());
#define FOR(i, x, n) for (ll i =x; i<=n; ++i)
#define RFOR(i, x, n) for (ll i =x; i>=n; --i)
using namespace std;
//using namespace __gnu_pbds;
//#define ordered_set tree<int, null_type, less<int>, rb_tree_tag, tree_order_statistics_node_update>
//#define ordered_multiset tree<int, null_type, less_equal<int>, rb_tree_tag, tree_order_statistics_node_update>
typedef long long ll;
typedef __int128 ull;
typedef long double ld;
typedef pair<ld, ll> pd;
typedef pair<string, ll> psl;
typedef pair<ll, ll> pi;
typedef pair<ll, pi> pii;
typedef pair<pi, pi> piii;

#include "prisoner.h"

void prisoner(int N, int id)
{
    long long now = openBox(id);
    while (now!=id) now = openBox(now);
}