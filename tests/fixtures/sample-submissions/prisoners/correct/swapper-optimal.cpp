#include "swapper.h"
#include <bits/stdc++.h>
using namespace std;

void swapper(int N, int boxes[]) {
    std::vector <int> visited(2*N, 0);
    for(int i=0; i<2*N; i++){
        int cnt=0, curr=i;
        std::vector <int> cc;
        while(!visited[curr]){
            cc.push_back(curr);
            visited[curr]=1;
            curr=boxes[curr];
            cnt++;
        }

        if(cnt>=N){
            swapKeys(cc[cnt-1], cc[(cnt-1)/2]);
        }
    }
}