#include "swapper.h"

#include <bits/stdc++.h>
using namespace std;

typedef long long ll;
typedef pair<ll, ll> pi;
typedef vector <int> vi;
typedef vector <pi> vpi;
typedef pair<pi, ll> pii;
typedef set <ll> si;
typedef long double ld;
#define f first
#define s second
#define mp make_pair
#define FOR(i,s,e) for(int i=s;i<=int(e);++i)
#define DEC(i,s,e) for(int i=s;i>=int(e);--i)
#define pb push_back
#define all(x) (x).begin(), (x).end()
#define lbd(x, y) lower_bound(all(x), y)
#define ubd(x, y) upper_bound(all(x), y)
#define aFOR(i,x) for (auto i: x)
#define mem(x,i) memset(x,i,sizeof x)
#define fast ios_base::sync_with_stdio(false),cin.tie(0),cout.tie(0)
#define maxn 200010
#define INF 1e9
#define MOD 998244353
typedef pair <vi, int> pvi;
typedef pair <int,pi> ipi;

void swapper(int N, int boxes[]) {
    int key0, key1;
    FOR(i,0,2*N-1){
        if (boxes[i] == 0) key0 = i;
        if (boxes[i] == 1) key1 = i;
    }
    if (N == 1){
        if (key0 == 1) swapKeys(0,1);
        return;
    }

    //move key 0 to key 1
    if (key1 < N){
        if (key0 == 1) return;
        if (key1 == 1) swapKeys(1,key0);
        else swapKeys(0,key0);
    }else{
        if (key0 == 2*N-1) return;
        if (key1 == 2*N-1) swapKeys(2*N-2,key0);
        else{
            //~ cout << boxes[2*N-1] << ' ' << 0 << '\n';
            swapKeys(2*N-1,key0);
        }
    }
}