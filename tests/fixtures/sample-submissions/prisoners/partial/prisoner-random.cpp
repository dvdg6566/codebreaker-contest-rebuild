#include <bits/stdc++.h>
using namespace std;
using ll = long long;
#define MAXN (1000005)
mt19937 rng2(500);
inline long long rand(ll x,ll y){ //random number between [x,y] inclusive
    return (rng2() % (y + 1 - x)) + x;
}

#include "prisoner.h"

void prisoner(int N, int id) {
    vector<ll> possible;
    for(ll i = 0;i < 2*N;i++){
        possible.push_back(i);
    }
    shuffle(possible.begin(),possible.end(),rng2);
    for(ll i = 0;i < N;i++){
        openBox(possible[i]);
    }
}