#include "prisoner.h"
#include <bits/stdc++.h>
using namespace std;

void prisoner(int N, int id) {
    int curr=openBox(id);
    while(curr!=id){
        curr=openBox(curr);
    }
}